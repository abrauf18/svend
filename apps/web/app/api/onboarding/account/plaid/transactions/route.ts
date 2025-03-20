import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { createTransactionService, PlaidConnectionItemSummary } from '~/lib/server/transaction.service';


// PATCH /api/onboarding/account/plaid/transactions
// Sync Plaid transactions to db (budget transactions if linked, otherwise unlinked)
export const PATCH = enhanceRouteHandler(
  async ({ user }) => {
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      const supabase = getSupabaseServerClient();
      const supabaseAdmin = getSupabaseServerAdminClient();

      // Get onboarding state with budget ID
      const { data: onboardingData, error: onboardingError } = await supabase
        .from('user_onboarding')
        .select('state->account')
        .eq('user_id', user.id)
        .single();

      if (onboardingError) throw onboardingError;

      const onboardingState = onboardingData?.account as any;
      if (!['start', 'plaid', 'manual'].includes(onboardingState.contextKey)) {
        return NextResponse.json({ error: 'Invalid onboarding state' }, { status: 403 });
      }

      const budgetId = onboardingState.budgetId;
      if (!budgetId) {
        return NextResponse.json({ error: 'No budget found in onboarding state' }, { status: 404 });
      }

      // Get all plaid items that have accounts linked to this budget
      const { data: plaidItems, error: plaidItemsError } = await supabaseAdmin
        .from('plaid_connection_items')
        .select(`
          id,
          access_token,
          next_cursor,
          plaid_accounts (
            id,
            plaid_account_id,
            budget_fin_accounts (
              id,
              budget_id
            )
          )
        `)
        .eq('owner_account_id', user.id)
        .eq('plaid_accounts.budget_fin_accounts.budget_id', budgetId);

      if (plaidItemsError) throw plaidItemsError;
      
      const plaidConnectionItems: PlaidConnectionItemSummary[] = plaidItems.map(item => ({
        svendItemId: item.id,
        accessToken: item.access_token,
        nextCursor: item.next_cursor || '',
        plaidAccounts: item.plaid_accounts.map(account => ({
          svendAccountId: account.id,
          plaidAccountId: account.plaid_account_id,
          budgetFinAccountIds: account.budget_fin_accounts.map(ba => ba.id)
        }))
      }));

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
      const transactionService = createTransactionService(supabaseAdmin);
      
      const { data: syncResult, error: syncError } = await transactionService.syncPlaidTransactions(
        plaidConnectionItems,
        plaidClient
      );

      if (syncError) throw new Error(syncError);

      return NextResponse.json(syncResult);
    } catch (err: any) {
      console.error('Failed to sync Plaid transactions:', err);
      return NextResponse.json(
        { error: 'Failed to sync transactions' },
        { status: 500 }
      );
    }
  }
);
