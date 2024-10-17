import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode } from 'plaid';
import { AccountOnboardingPlaidConnectionItem } from '@kit/accounts/components';

export async function POST(request: Request) {
  const supabaseClient = getSupabaseServerClient();
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // TODO: only allow route if budget exists and is still being onboarded

  const { budgetId, plaidPublicToken } = await request.json();

  if (!budgetId || !plaidPublicToken) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  const plaidConfiguration = new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
      },
    },
  });

  const plaidClient = new PlaidApi(plaidConfiguration);

  try {
    // Exchange the public token for an access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: plaidPublicToken
    });

    const accessToken = exchangeResponse.data.access_token;
    const plaidItemId = exchangeResponse.data.item_id;

    // Get item to retrieve institution ID
    const itemResponse = await plaidClient.itemGet({
      access_token: accessToken,
    });

    const institutionId = itemResponse.data.item.institution_id as string;
    if (typeof institutionId !== 'string') {
      return NextResponse.json({ error: 'Invalid institution ID' }, { status: 400 });
    }

    // Get institution details
    const institutionResponse = await plaidClient.institutionsGetById({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
      options: {
        include_optional_metadata: true
      }
    });

    const institutionName = institutionResponse.data.institution.name;
    const institutionLogoBase64 = institutionResponse.data.institution.logo;

    // use admin client for remaining operations
    const supabaseAdminClient = getSupabaseServerAdminClient();

    // Check if the logo for this institution already exists in the storage bucket
    const { data: existingLogos, error: existingLogoError } = await supabaseAdminClient.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET_PLAID_ITEM_INSTITUTION_LOGOS as string)
      .list('', {
        limit: 1,
        search: `name=${institutionId}.png`
      });

    let institutionLogoStorageName;
    if (existingLogoError) {
      console.warn(`Error checking existing logo for institution ID ${institutionId}:`, existingLogoError);
    } else if (existingLogos && existingLogos.length > 0) {
      // Logo found in storage bucket
      institutionLogoStorageName = existingLogos[0]?.name;
    } else if (institutionLogoBase64) {
      // Upload the logo to the storage bucket
      institutionLogoStorageName = `${institutionId}.png`;
      const { data: uploadData, error: uploadError } = await supabaseAdminClient.storage
        .from(process.env.SUPABASE_STORAGE_BUCKET_PLAID_ITEM_INSTITUTION_LOGOS as string)
        .upload(institutionLogoStorageName, Buffer.from(institutionLogoBase64, 'base64'), {
          contentType: 'image/png',
          upsert: true,
          metadata: {
            institution_name: institutionName,
            institution_id: institutionId
          }
        });

      if (uploadError) {
        console.warn(`Error uploading institution logo for institution ID ${institutionId}:`, uploadError);
      }
    }

    // Insert the Plaid connection item into the database and return the id
    const { data: insertedData, error } = await supabaseAdminClient
      .from('plaid_connection_items')
      .insert({
        account_id: user.id,
        access_token: accessToken,
        plaid_item_id: plaidItemId,
        institution_id: institutionId,
        institution_name: institutionName,
        institution_logo_storage_name: institutionLogoStorageName,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error storing Plaid connection:', error);
      return NextResponse.json({ error: 'Failed to store Plaid connection' }, { status: 500 });
    }

    const newPlaidConnectionSvendItemId = insertedData?.id;

    if (error) {
      console.error('Error storing Plaid connection:', error);
      return NextResponse.json({ error: 'Failed to store Plaid connection' }, { status: 500 });
    }

    // Get accounts associated with the item
    const plaidItemAccountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    // Insert the accounts into the database using add_budget_plaid_account function
    const accountInsertResults = await Promise.all(plaidItemAccountsResponse.data.accounts.map(async (plaidAccount) => {
      const rpcParams = {
        p_budget_id: budgetId,
        p_plaid_conn_item_id: newPlaidConnectionSvendItemId,
        p_plaid_account_id: plaidAccount.account_id,
        p_account_id: user.id,
        p_balance_available: plaidAccount.balances.available || 0,
        p_balance_current: plaidAccount.balances.current || 0,
        p_balance_limit: plaidAccount.balances.limit || 0,
        p_iso_currency_code: plaidAccount.balances.iso_currency_code || '',
        p_mask: plaidAccount.mask || '',
        p_name: plaidAccount.name,
        p_official_name: plaidAccount.official_name || '',
        p_plaid_persistent_account_id: plaidAccount.persistent_account_id || '',
        p_type: plaidAccount.type,
        p_subtype: plaidAccount.subtype || ''
      }

      const { data, error } = await supabaseAdminClient.rpc('add_budget_plaid_account', rpcParams);
      if (error) {
        console.error('Error inserting Plaid account:', error);
        return { error };
      }
      return { id: data, plaidAccount };
    }));

    const accountsInsertError = accountInsertResults.find(result => result.error);

    if (accountsInsertError) {
      console.error('Error storing Plaid accounts:', accountsInsertError.error);
      return NextResponse.json({ error: 'Failed to store Plaid accounts' }, { status: 500 });
    }

    // Fetch the current onboardingstate
    const { data: dbOnboardingData, error: fetchOnboardingError } = await supabaseAdminClient
      .from('onboarding')
      .select('state')
      .eq('account_id', user.id)
      .single();

    if (fetchOnboardingError) {
      console.error('Error fetching onboarding state:', fetchOnboardingError);
      return NextResponse.json({ error: 'Failed to fetch onboarding state' }, { status: 500 });
    }

    let dbUpdatedOnboardingState = dbOnboardingData.state as any;
    dbUpdatedOnboardingState.account.contextKey = 'plaid';
    // Update the state in the database
    const { error: onboardingUpdateError } = await supabaseAdminClient
      .from('onboarding')
      .update({ state: dbUpdatedOnboardingState })
      .eq('account_id', user.id);

    if (onboardingUpdateError) {
      console.error('Error updating onboarding state:', onboardingUpdateError);
      return NextResponse.json({ error: 'Failed to update onboarding state' }, { status: 500 });
    }

    const resPlaidItemAccounts = plaidItemAccountsResponse.data.accounts.map((plaidAccount) => ({
      svendAccountId: accountInsertResults.find(result => result.plaidAccount?.account_id === plaidAccount.account_id)?.id || '',
      svendItemId: newPlaidConnectionSvendItemId,
      plaidAccountId: plaidAccount.account_id,
      ownerAccountId: user.id,
      accountName: plaidAccount.name,
      accountType: plaidAccount.type.toString(),
      accountSubType: plaidAccount.subtype?.toString() || '',
      mask: plaidAccount.mask || '',
    }));

    const { data, error: err } = await supabaseAdminClient
      .storage
      .from(process.env.SUPABASE_STORAGE_BUCKET_PLAID_ITEM_INSTITUTION_LOGOS as string)
      .createSignedUrl(institutionLogoStorageName as string, 3600) // 3600 seconds = 1 hour
    console.log('signedUrl', data?.signedUrl);

    // Construct the plaidConnectionItems array
    const resPlaidConnectionItem: AccountOnboardingPlaidConnectionItem = {
      svendItemId: newPlaidConnectionSvendItemId,
      plaidItemId: plaidItemId,
      institutionName: institutionName,
      institutionLogoSignedUrl: data?.signedUrl || '',
      itemAccounts: resPlaidItemAccounts
    };

    return NextResponse.json({
      success: true,
      message: 'Plaid connection successfully onboarded',
      plaidConnectionItem: resPlaidConnectionItem
    });
  } catch (error) {
    console.error('Error in Plaid onboarding:', error);
    return NextResponse.json({ error: 'Failed to complete Plaid onboarding' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const supabaseClient = getSupabaseServerClient();
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // TODO: only allow route if budget exists and is still being onboarded
  const { svendPlaidAccountId, action } = await request.json();

  if (action !== 'remove_account') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  // use admin client for remaining operations
  const supabaseAdminClient = getSupabaseServerAdminClient();

  // Fetch the current onboardingstate
  const { data: dbAccountOnboardingData, error: fetchOnboardingError } = await supabaseAdminClient
    .from('onboarding')
    .select('state->account')
    .eq('account_id', user.id)
    .single();

  if (fetchOnboardingError) {
    console.error('Error fetching onboarding state:', fetchOnboardingError);
    return NextResponse.json({ error: 'Failed to fetch onboarding state' }, { status: 500 });
  }

  let dbAccountOnboardingState = dbAccountOnboardingData.account as any;

  const { data, error } = await supabaseAdminClient.rpc('remove_plaid_account', {
    p_budget_id: dbAccountOnboardingState.budgetId,
    p_plaid_account_id: svendPlaidAccountId
  });

  if (error) {
    console.error('Error removing Plaid account:', error);
    return NextResponse.json({ error: 'Failed to remove Plaid account' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Plaid account removed successfully', data });
}
