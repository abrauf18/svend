import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode } from 'plaid';

export async function GET(request: Request) {
  // Function to create absolute URLs
  const createAbsoluteUrl = (path: string) => `${process.env.NEXT_PUBLIC_SITE_URL}${path}`;

  const { searchParams } = new URL(request.url);

  console.log('oauth-redirect >> incoming request URL:', request.url);
  console.log('oauth-redirect >> searchParams:', searchParams.toString());

  const budgetId = searchParams.get('budget_id');
  const redirectType = searchParams.get('redirect_type');
  const publicToken = searchParams.get('public_token');

  if (!budgetId || !redirectType || !publicToken) {
    return NextResponse.redirect(createAbsoluteUrl('/onboarding/account?error=missing_params'));
  }

  const supabase = getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(createAbsoluteUrl('/onboarding?error=unauthorized'));
  }

  const configuration = new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
      },
    },
  });

  const client = new PlaidApi(configuration);

  try {
    // Exchange the public token for an access token
    const exchangeResponse = await client.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Get item to retrieve institution ID
    const itemResponse = await client.itemGet({
      access_token: accessToken,
    });

    const institutionId = itemResponse.data.item.institution_id as string;
    if (typeof institutionId !== 'string') {
      return NextResponse.redirect(createAbsoluteUrl('/onboarding?error=invalid_institution_id'));
    }

    // Get institution details
    const institutionResponse = await client.institutionsGetById({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      institution_id: institutionId,
      country_codes: [CountryCode.Us]
    });

    const institutionName = institutionResponse.data.institution.name;
    const institutionLogoBase64 = institutionResponse.data.institution.logo;

    // Check if the logo for this institution already exists in the storage bucket
    const { data: existingLogos, error: existingLogoError } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET_PLAID_ITEM_INSTITUTION_LOGOS as string)
      .list('', {
        limit: 1,
        search: `name=${institutionId}.png`
      });

    if (existingLogoError) {
      console.warn(`Error checking existing logo for institution ID ${institutionId}:`, existingLogoError);
    }

    let institutionLogoObjName;

    if (existingLogos && existingLogos.length > 0) {
      // Logo found in storage bucket
      institutionLogoObjName = existingLogos[0]?.name;
    } else if (!existingLogoError && institutionLogoBase64) {
      // Upload the logo to the storage bucket
      console.log(`Uploading institution logo ${institutionId}.png to bucket ${process.env.SUPABASE_STORAGE_BUCKET_PLAID_ITEM_INSTITUTION_LOGOS}`);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(process.env.SUPABASE_STORAGE_BUCKET_PLAID_ITEM_INSTITUTION_LOGOS as string)
        .upload(`${institutionId}.png`, Buffer.from(institutionLogoBase64, 'base64'), {
          contentType: 'image/png',
          upsert: true,
          metadata: {
            institution_id: institutionId
          }
        });

      if (uploadError) {
        console.warn(`Error uploading institution logo for institution ID ${institutionId}:`, uploadError);
      } else {
        institutionLogoObjName = uploadData.path;
      }
    }

    // Insert the Plaid connection item into the database
    const { data: plaidConnectionItem, error } = await supabase.from('plaid_connection_items').insert({
      account_id: user.id,
      access_token: accessToken,
      plaid_item_id: itemId,
      institution_id: institutionId,
      institution_name: institutionName,
      institution_logo_storage_name: institutionLogoObjName,
    })
      .select('id')
      .single();

      if (error) {
        console.error('Error storing Plaid connection:', error);
        return NextResponse.redirect(createAbsoluteUrl('/onboarding?error=db_error'));
      }
      
      const newPlaidConnectionSvendItemId = plaidConnectionItem?.id;

    // Now, let's add the Plaid accounts associated with this item
    const accountsResponse = await client.accountsGet({
      access_token: accessToken,
    });

    for (const plaidAccount of accountsResponse.data.accounts) {
      const rpcParams = {
        // required fields
        p_budget_id: budgetId,
        p_plaid_conn_item_id: newPlaidConnectionSvendItemId,
        p_plaid_account_id: plaidAccount.account_id,
        p_account_id: user.id,
        p_name: plaidAccount.name,
        p_type: plaidAccount.type,

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

      await supabase.rpc('add_budget_plaid_account', rpcParams);
    }

    // Redirect based on the redirectType
    let redirectPath;
    if (redirectType === 'account') {
      redirectPath = '/onboarding/account';
    } else if (redirectType === 'budget') {
      redirectPath = `/onboarding/budget/${budgetId}`;
    } else {
      // Default fallback, you may want to adjust this
      redirectPath = '/onboarding?error=invalid_redirect_type';
    }

    return NextResponse.redirect(createAbsoluteUrl(redirectPath));
  } catch (error) {
    console.error('Error in oauth-redirect:', error);
    let errorPath;
    if (redirectType === 'account') {
      errorPath = '/onboarding/account?error=plaid_exchange';
    } else if (redirectType === 'budget') {
      errorPath = `/onboarding/budget/${budgetId}?error=plaid_exchange`;
    } else {
      // Default fallback, you may want to adjust this
      errorPath = '/onboarding?error=invalid_redirect_type';
    }
    return NextResponse.redirect(createAbsoluteUrl(errorPath));
  }
}
