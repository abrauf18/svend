import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { createAccountOnboardingService } from '~/lib/server/onboarding.service';

export async function GET(request: Request) {
  const supabaseClient = getSupabaseServerClient();
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // TODO: only allow route if budget exists and is still being onboarded

  // use admin client for remaining operations
  const supabaseAdminClient = getSupabaseServerAdminClient();

  // Fetch the current onboardingstate
  const { data: dbAccountOnboardingState, error: fetchOnboardingError } = await supabaseAdminClient
    .from('onboarding')
    .select('state->account')
    .eq('account_id', user.id)
    .single();

  if (fetchOnboardingError) {
    console.error('Error fetching onboarding state:', fetchOnboardingError);
    return NextResponse.json({ error: 'Failed to fetch onboarding state' }, { status: 500 });
  }

  const budgetId = (dbAccountOnboardingState.account as any)?.budgetId;

  // First, let's fetch the Plaid accounts associated with the budget
  const { data: budgetPlaidAccounts, error: budgetPlaidAccountsError } = await supabaseAdminClient
    .from('budget_plaid_accounts')
    .select('plaid_account_id')
    .eq('budget_id', budgetId);

  if (budgetPlaidAccountsError) {
    console.error('Error fetching budget Plaid accounts:', budgetPlaidAccountsError);
    return NextResponse.json({ error: 'Failed to fetch budget Plaid accounts' }, { status: 500 });
  }

  // Now, let's fetch the Plaid accounts and their associated items
  const { data: plaidAccounts, error: plaidAccountsError } = await supabaseAdminClient
    .from('plaid_accounts')
    .select(`
      id,
      plaid_account_id,
      name,
      mask,
      type,
      subtype,
      plaid_connection_items (
        id,
        plaid_item_id,
        institution_name,
        institution_logo_storage_name
      )
    `)
    .in('id', budgetPlaidAccounts.map(account => account.plaid_account_id));

  if (plaidAccountsError) {
    console.error('Error fetching Plaid accounts:', plaidAccountsError);
    return NextResponse.json({ error: 'Failed to fetch Plaid accounts' }, { status: 500 });
  }

  // Group accounts by their parent item
  const itemsMap = new Map();
  plaidAccounts.forEach(plaidAccount => {
    const item = plaidAccount.plaid_connection_items as any;
    if (!itemsMap.has(item.id)) {
      itemsMap.set(item.id, {
        svendItemId: item.id,
        plaidItemId: item.plaid_item_id,
        institutionName: item.institution_name,
        institutionLogoStorageName: item.institution_logo_storage_name,
        institutionLogoSignedUrl: '',
        itemAccounts: []
      });
    }
    itemsMap.get(item.id).itemAccounts.push({
      svendAccountId: plaidAccount.id,
      svendItemId: item.id,
      plaidAccountId: plaidAccount.plaid_account_id,
      ownerAccountId: user.id,
      accountName: plaidAccount.name,
      accountType: plaidAccount.type,
      accountSubType: plaidAccount.subtype || '',
      mask: plaidAccount.mask || '',
    });
  });

  const plaidConnectionItems = Array.from(itemsMap.values());

  console.log('Creating institution logo signed URLs...');

  // Create signed URLs for institution logos
  try {
    for (const item of plaidConnectionItems) {
      if (item.institutionLogoStorageName) {
        const { data, error: signedUrlError } = await supabaseAdminClient
          .storage
          .from(process.env.SUPABASE_STORAGE_BUCKET_PLAID_ITEM_INSTITUTION_LOGOS as string)
          .createSignedUrl(item.institutionLogoStorageName, 3600);

        if (signedUrlError) {
          console.warn('Error creating signed URL for institution logo:', signedUrlError);
        } else {
          item.institutionLogoSignedUrl = data?.signedUrl || '';
          console.log('Institution logo signed URL:', item.institutionLogoSignedUrl);
        }
      }
    }
  } catch (error) {
    console.error('Error creating signed URLs for institution logos:', error);
  }

  return NextResponse.json({
    success: true,
    message: 'Account onboarding state successfully retrieved',
    accountOnboardingState: {
      budgetId: budgetId,
      contextKey: (dbAccountOnboardingState.account as any)?.contextKey,
      userId: user.id,
      plaidConnectionItems: plaidConnectionItems
    }
  });
}

export async function PUT(request: Request) {
  const supabase = getSupabaseServerClient();

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { contextKey } = body;

  // TODO: remove 'analyze_spending' from validContextKeys because once goals are persisted, the transition will happen there
  const validContextKeys = ['profile_goals', 'analyze_spending'];

  if (!contextKey || !validContextKeys.includes(contextKey)) {
    return NextResponse.json({ error: 'Invalid or missing contextKey' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseServerAdminClient();
  const onboardingService = createAccountOnboardingService();

  try {
    const updateErrorMessage = await onboardingService.updateContextKey({
      supabase: supabaseAdmin,
      userId: user.id,
      contextKey,
      validContextKeys
    });
    if (updateErrorMessage) {
      return NextResponse.json({ error: updateErrorMessage, contextKey: contextKey }, { status: 409 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to update context key:' + error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Context key updated successfully' });
}
