import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode } from 'plaid';
import { AccountOnboardingPlaidConnectionItem } from '~/lib/model/onboarding.types';

// POST /api/onboarding/account/plaid/item
// Add a new Plaid connection item to the database
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
      console.log(`Uploading institution logo ${institutionId}.png to bucket ${process.env.SUPABASE_STORAGE_BUCKET_PLAID_ITEM_INSTITUTION_LOGOS}`);
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
        console.warn(`Error uploading institution logo ${institutionId}.png to bucket ${process.env.SUPABASE_STORAGE_BUCKET_PLAID_ITEM_INSTITUTION_LOGOS}:`, uploadError);
        institutionLogoStorageName = null; // Set to null if upload fails
      }
    }

    // Insert the Plaid connection item into the database and return the id
    const { data: insertedData, error } = await supabaseAdminClient
      .from('plaid_connection_items')
      .insert({
        owner_account_id: user.id,
        access_token: accessToken,
        plaid_item_id: plaidItemId,
        institution_id: institutionId,
        institution_name: institutionName,
        institution_logo_storage_name: institutionLogoStorageName || null, // Use null if not set
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
        // required fields
        p_budget_id: budgetId,
        p_plaid_conn_item_id: newPlaidConnectionSvendItemId,
        p_plaid_account_id: plaidAccount.account_id,
        p_account_id: user.id,
        p_name: plaidAccount.name,
        p_type: plaidAccount.type.toLowerCase() as "investment" | "depository" | "credit" | "loan" | "other",

        // nullable fields
        p_mask: plaidAccount.mask as string | undefined,
        p_balance_available: plaidAccount.balances.available as number | undefined,
        p_balance_current: plaidAccount.balances.current as number | undefined,
        p_balance_limit: plaidAccount.balances.limit as number | undefined,
        p_iso_currency_code: plaidAccount.balances.iso_currency_code as string | undefined,
        p_official_name: plaidAccount.official_name as string | undefined,
        p_plaid_persistent_account_id: plaidAccount.persistent_account_id as string | undefined,
        p_subtype: plaidAccount.subtype as string | undefined
      }

      const { data, error } = await supabaseAdminClient.rpc('add_budget_plaid_account', rpcParams);
      if (error) {
        console.error(`Error inserting Plaid account ${plaidAccount.account_id}:`, error);
        return { error };
      }
      return { data, plaidAccount };
    }));

    const accountsInsertError = accountInsertResults.find(result => result.error);

    if (accountsInsertError) {
      console.error('Error storing Plaid accounts:', accountsInsertError.error);
      return NextResponse.json({ error: 'Failed to store Plaid accounts' }, { status: 500 });
    }

    // Fetch the current onboardingstate
    const { data: dbOnboardingData, error: fetchOnboardingError } = await supabaseAdminClient
      .from('user_onboarding')
      .select('state')
      .eq('user_id', user.id)
      .single();

    if (fetchOnboardingError) {
      console.error('Error fetching onboarding state:', fetchOnboardingError);
      return NextResponse.json({ error: 'Failed to fetch onboarding state' }, { status: 500 });
    }

    // let dbUpdatedOnboardingState = dbOnboardingData.state as any;
    // dbUpdatedOnboardingState.account.contextKey = 'plaid';
    // // Update the state in the database
    // const { error: onboardingUpdateError } = await supabaseAdminClient
    //   .from('user_onboarding')
    //   .update({ state: dbUpdatedOnboardingState })
    //   .eq('user_id', user.id);

    // if (onboardingUpdateError) {
    //   console.error('Error updating onboarding state:', onboardingUpdateError);
    //   return NextResponse.json({ error: 'Failed to update onboarding state' }, { status: 500 });
    // }

    const resPlaidItemAccounts = plaidItemAccountsResponse.data.accounts.map((plaidAccount) => {
      const insertedAccount = accountInsertResults.find(result => result.plaidAccount?.account_id === plaidAccount.account_id);
      return {
        svendAccountId: insertedAccount?.data?.plaid_account_id as string,
        svendItemId: newPlaidConnectionSvendItemId,
        plaidAccountId: plaidAccount.account_id,
        ownerAccountId: user.id,
        accountName: plaidAccount.name,
        accountType: plaidAccount.type.toString(),
        accountSubType: plaidAccount.subtype?.toString() || '',
        mask: plaidAccount.mask || '',
        budgetFinAccountId: insertedAccount?.data?.budget_fin_account_id as string,
        plaidPersistentAccountId: plaidAccount.persistent_account_id || '',
        officialName: plaidAccount.official_name || '',
        balanceAvailable: plaidAccount.balances.available || 0,
        balanceCurrent: plaidAccount.balances.current || 0,
        balanceLimit: plaidAccount.balances.limit || 0,
        isoCurrencyCode: plaidAccount.balances.iso_currency_code || '',
        createdAt: insertedAccount?.data?.created_at as string,
        updatedAt: insertedAccount?.data?.updated_at as string
      };
    });

    const { data, error: err } = await supabaseAdminClient
      .storage
      .from(process.env.SUPABASE_STORAGE_BUCKET_PLAID_ITEM_INSTITUTION_LOGOS as string)
      .createSignedUrl(institutionLogoStorageName as string, 3600) // 3600 seconds = 1 hour
    console.log('signedUrl', data?.signedUrl);

    // Construct the response item
    const resPlaidConnectionItem: AccountOnboardingPlaidConnectionItem = {
      svendItemId: newPlaidConnectionSvendItemId,
      plaidItemId: plaidItemId,
      institutionName: institutionName,
      institutionLogoSignedUrl: data?.signedUrl || '',
      itemAccounts: resPlaidItemAccounts.map((account) => ({
        ...account,
        budgetFinAccountId: account.budgetFinAccountId
      }))
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

// DELETE /api/onboarding/account/plaid/item
// Remove a Plaid connection item from the database,
// along with all associated accounts, their transactions and their connections to the onboarding budget
export async function DELETE(request: Request) {
  const supabaseClient = getSupabaseServerClient();
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { svendItemId } = await request.json();

  // Use admin client for remaining operations
  const supabaseAdminClient = getSupabaseServerAdminClient();

  // Fetch the access token for the item to be deleted
  const { data: plaidItemData, error: fetchError } = await supabaseAdminClient
    .from('plaid_connection_items')
    .select('access_token')
    .eq('id', svendItemId)
    .single();

  if (fetchError || !plaidItemData) {
    console.error('Error fetching Plaid item access token:', fetchError);
    return NextResponse.json({ error: 'Failed to fetch Plaid item access token' }, { status: 500 });
  }

  const accessToken = plaidItemData.access_token;

  // Initialize Plaid client
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
    // Call Plaid API to remove the item
    await plaidClient.itemRemove({
      access_token: accessToken,
    });
  } catch (plaidError) {
    console.error('Error removing Plaid item:', plaidError);
    return NextResponse.json({ error: 'Failed to remove Plaid item from Plaid' }, { status: 500 });
  }

  // Delete the item from the database
  const { data, error } = await supabaseAdminClient
    .from('plaid_connection_items')
    .delete()
    .eq('id', svendItemId);

  if (error) {
    console.error('Error removing Plaid connection item:', error);
    return NextResponse.json({ error: 'Failed to remove Plaid connection item' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Plaid connection item removed successfully', data });
}