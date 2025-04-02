import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode } from 'plaid';
import { AccountOnboardingPlaidConnectionItem } from '~/lib/model/onboarding.types';

// POST /api/onboarding/budget/plaid/item
// Add a new Plaid connection item to the database
export async function POST(
  request: Request,
  { params }: { params: { budgetSlug: string } },
) {
  const supabaseClient = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { budgetSlug } = params;
  const { plaidPublicToken } = await request.json();

  if (!budgetSlug || !plaidPublicToken) {
    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 },
    );
  }

  // Fetch the current budget data
  const { data: dbBudgetData, error: fetchBudgetError } = await supabaseClient
    .from('budgets')
    .select('id, current_onboarding_step, accounts!inner(slug)')
    .eq('accounts.slug', budgetSlug)
    .single();

  if (fetchBudgetError || !dbBudgetData) {
    console.error('Error fetching budget:', fetchBudgetError);
    return NextResponse.json(
      { error: 'Failed to fetch budget' },
      { status: 500 },
    );
  }

  if (
    !['start', 'plaid', 'manual'].includes(dbBudgetData.current_onboarding_step)
  ) {
    return NextResponse.json(
      { error: 'Onboarding not in correct state' },
      { status: 409 },
    );
  }

  const budgetId = dbBudgetData.id;

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
      public_token: plaidPublicToken,
    });

    const accessToken = exchangeResponse.data.access_token;
    const plaidItemId = exchangeResponse.data.item_id;

    // Get item to retrieve institution ID
    const itemResponse = await plaidClient.itemGet({
      access_token: accessToken,
    });

    const institutionId = itemResponse.data.item.institution_id as string;
    if (typeof institutionId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid institution ID' },
        { status: 400 },
      );
    }

    // Get institution details
    const institutionResponse = await plaidClient.institutionsGetById({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
      options: {
        include_optional_metadata: true,
      },
    });

    const institutionName = institutionResponse.data.institution.name;
    const institutionLogoBase64 = institutionResponse.data.institution.logo;

    // use admin client for remaining operations
    const supabaseAdminClient = getSupabaseServerAdminClient();

    // Check if the logo for this institution already exists in the storage bucket
    const { data: existingLogos, error: existingLogoError } =
      await supabaseAdminClient.storage
        .from(
          process.env
            .SUPABASE_STORAGE_BUCKET_PLAID_ITEM_INSTITUTION_LOGOS as string,
        )
        .list('', {
          limit: 1,
          search: `name=${institutionId}.png`,
        });

    let institutionLogoStorageName;
    if (existingLogoError) {
      console.warn(
        `Error checking existing logo for institution ID ${institutionId}:`,
        existingLogoError,
      );
    } else if (existingLogos && existingLogos.length > 0) {
      // Logo found in storage bucket
      institutionLogoStorageName = existingLogos[0]?.name;
    } else if (institutionLogoBase64) {
      // Upload the logo to the storage bucket
      institutionLogoStorageName = `${institutionId}.png`;
      console.log(
        `Uploading institution logo ${institutionId}.png to bucket ${process.env.SUPABASE_STORAGE_BUCKET_PLAID_ITEM_INSTITUTION_LOGOS}`,
      );
      const { data: uploadData, error: uploadError } =
        await supabaseAdminClient.storage
          .from(
            process.env
              .SUPABASE_STORAGE_BUCKET_PLAID_ITEM_INSTITUTION_LOGOS as string,
          )
          .upload(
            institutionLogoStorageName,
            Buffer.from(institutionLogoBase64, 'base64'),
            {
              contentType: 'image/png',
              upsert: true,
              metadata: {
                institution_name: institutionName,
                institution_id: institutionId,
              },
            },
          );

      if (uploadError) {
        console.warn(
          `Error uploading institution logo ${institutionId}.png to bucket ${process.env.SUPABASE_STORAGE_BUCKET_PLAID_ITEM_INSTITUTION_LOGOS}:`,
          uploadError,
        );
        institutionLogoStorageName = null; // Set to null if upload fails
      }
    }

    // Get accounts associated with the item with retry
    let plaidItemAccountsResponse;
    const maxRetries = 3;
    const retryDelay = 5000; // 5 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      plaidItemAccountsResponse = await plaidClient.accountsGet({
        access_token: accessToken,
      });

      if (plaidItemAccountsResponse.data.accounts.length > 0) {
        break;
      }

      console.warn(
        `onboarding: No Plaid accounts found, attempt ${attempt} of ${maxRetries}`,
      );

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    if (!plaidItemAccountsResponse?.data.accounts.length) {
      console.error('onboarding: Failed to get Plaid accounts after retries');
      return NextResponse.json(
        { error: 'No accounts found for this institution' },
        { status: 400 },
      );
    }

    // Only insert after confirming we have accounts
    const { data: insertedData, error } = await supabaseAdminClient
      .from('plaid_connection_items')
      .insert({
        owner_account_id: user.id,
        access_token: accessToken,
        plaid_item_id: plaidItemId,
        institution_id: institutionId,
        institution_name: institutionName,
        institution_logo_storage_name: institutionLogoStorageName || null,
        meta_data: {
          created_for: budgetId,
        },
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error storing Plaid connection:', error);
      return NextResponse.json(
        { error: 'Failed to store Plaid connection' },
        { status: 500 },
      );
    }

    const newPlaidConnectionSvendItemId = insertedData?.id;

    // Insert the accounts into the database using add_budget_plaid_account function
    const accountInsertResults = await Promise.all(
      plaidItemAccountsResponse.data.accounts.map(async (plaidAccount) => {
        const rpcParams = {
          // required fields
          p_budget_id: budgetId,
          p_plaid_conn_item_id: newPlaidConnectionSvendItemId,
          p_plaid_account_id: plaidAccount.account_id,
          p_account_id: user.id,
          p_name: plaidAccount.name,
          p_type: plaidAccount.type.toLowerCase() as
            | 'investment'
            | 'depository'
            | 'credit'
            | 'loan'
            | 'other',

          // nullable fields
          p_mask: plaidAccount.mask as string | undefined,
          p_balance_available: plaidAccount.balances.available as
            | number
            | undefined,
          p_balance_current: plaidAccount.balances.current as
            | number
            | undefined,
          p_balance_limit: plaidAccount.balances.limit as number | undefined,
          p_iso_currency_code: plaidAccount.balances.iso_currency_code as
            | string
            | undefined,
          p_official_name: plaidAccount.official_name as string | undefined,
          p_plaid_persistent_account_id: plaidAccount.persistent_account_id as
            | string
            | undefined,
          p_subtype: plaidAccount.subtype as string | undefined,
          p_meta_data: { created_for: budgetId },
        };

        const { data, error } = await supabaseAdminClient.rpc(
          'add_budget_plaid_account',
          rpcParams,
        );
        if (error) {
          console.error(
            `Error inserting Plaid account ${plaidAccount.account_id}:`,
            error,
          );
          return { error };
        }
        return { data, plaidAccount };
      }),
    );

    const accountsInsertError = accountInsertResults.find(
      (result) => result.error,
    );

    if (accountsInsertError) {
      console.error('Error storing Plaid accounts:', accountsInsertError.error);
      return NextResponse.json(
        { error: 'Failed to store Plaid accounts' },
        { status: 500 },
      );
    }

    // Update the budget's onboarding step if needed
    // if (dbBudgetData.current_onboarding_step === 'start') {
    //   const { error: updateBudgetError } = await supabaseAdminClient
    //     .from('budgets')
    //     .update({ current_onboarding_step: 'plaid' })
    //     .eq('id', budgetId);

    //   if (updateBudgetError) {
    //     console.error('Error updating budget onboarding step:', updateBudgetError);
    //     // Don't fail the request if this update fails
    //   }
    // }

    const resPlaidItemAccounts = plaidItemAccountsResponse.data.accounts.map(
      (plaidAccount) => {
        const insertedAccount = accountInsertResults.find(
          (result) =>
            result.plaidAccount?.account_id === plaidAccount.account_id,
        );
        return {
          svendAccountId: insertedAccount?.data?.plaid_account_id as string,
          svendItemId: newPlaidConnectionSvendItemId,
          plaidAccountId: plaidAccount.account_id,
          ownerAccountId: user.id,
          accountName: plaidAccount.name,
          accountType: plaidAccount.type.toString(),
          accountSubType: plaidAccount.subtype?.toString() || '',
          mask: plaidAccount.mask || '',
          budgetFinAccountId: insertedAccount?.data
            ?.budget_fin_account_id as string,
          plaidPersistentAccountId: plaidAccount.persistent_account_id || '',
          officialName: plaidAccount.official_name || '',
          balanceAvailable: plaidAccount.balances.available || 0,
          balanceCurrent: plaidAccount.balances.current || 0,
          balanceLimit: plaidAccount.balances.limit || 0,
          isoCurrencyCode: plaidAccount.balances.iso_currency_code || '',
          meta_data: { created_for: budgetId },
          createdAt: insertedAccount?.data?.created_at as string,
          updatedAt: insertedAccount?.data?.updated_at as string,
        };
      },
    );

    const { data, error: err } = await supabaseAdminClient.storage
      .from(
        process.env
          .SUPABASE_STORAGE_BUCKET_PLAID_ITEM_INSTITUTION_LOGOS as string,
      )
      .createSignedUrl(institutionLogoStorageName as string, 3600); // 3600 seconds = 1 hour
    console.log('signedUrl', data?.signedUrl);

    // Construct the response item
    const resPlaidConnectionItem: AccountOnboardingPlaidConnectionItem = {
      svendItemId: newPlaidConnectionSvendItemId,
      plaidItemId: plaidItemId,
      institutionName: institutionName,
      institutionLogoSignedUrl: data?.signedUrl || '',
      meta_data: {
        created_for: budgetId,
      },
      itemAccounts: resPlaidItemAccounts.map((account) => ({
        ...account,
        budgetFinAccountId: account.budgetFinAccountId,
        transactions: [], // Add empty transactions array
      })),
    };

    return NextResponse.json({
      success: true,
      message: 'Plaid connection successfully onboarded',
      plaidConnectionItem: resPlaidConnectionItem,
    });
  } catch (error) {
    console.error('Error in Plaid onboarding:', error);
    return NextResponse.json(
      { error: 'Failed to complete Plaid onboarding' },
      { status: 500 },
    );
  }
}

// DELETE /api/onboarding/budget/plaid/item
// Remove a Plaid connection item from the database,
// along with all associated accounts, their transactions and their connections to the onboarding budget
export async function DELETE(
  request: Request,
  { params }: { params: { budgetSlug: string } },
) {
  const supabaseClient = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { budgetSlug } = params;
  const { svendItemId } = await request.json();

  // Fetch the current budget data
  const { data: dbBudgetData, error: fetchBudgetError } = await supabaseClient
    .from('budgets')
    .select('id, current_onboarding_step, accounts!inner(slug)')
    .eq('accounts.slug', budgetSlug)
    .single();

  if (fetchBudgetError || !dbBudgetData) {
    console.error('Error fetching budget:', fetchBudgetError);
    return NextResponse.json(
      { error: 'Failed to fetch budget' },
      { status: 500 },
    );
  }

  if (
    !['start', 'plaid', 'manual'].includes(dbBudgetData.current_onboarding_step)
  ) {
    return NextResponse.json(
      { error: 'Onboarding not in correct state' },
      { status: 409 },
    );
  }

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
    return NextResponse.json(
      { error: 'Failed to fetch Plaid item access token' },
      { status: 500 },
    );
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
    return NextResponse.json(
      { error: 'Failed to remove Plaid item from Plaid' },
      { status: 500 },
    );
  }

  // Delete the item from the database
  const { data, error } = await supabaseAdminClient
    .from('plaid_connection_items')
    .delete()
    .eq('id', svendItemId);

  if (error) {
    console.error('Error removing Plaid connection item:', error);
    return NextResponse.json(
      { error: 'Failed to remove Plaid connection item' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    message: 'Plaid connection item removed successfully',
    data,
  });
}
