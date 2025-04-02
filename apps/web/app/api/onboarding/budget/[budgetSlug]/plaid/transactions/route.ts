import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import {
  createTransactionService,
  PlaidConnectionItemSummary,
} from '~/lib/server/transaction.service';

// PATCH /api/onboarding/budget/plaid/transactions
// Sync Plaid transactions to db (budget transactions if linked, otherwise unlinked)
export const PATCH = enhanceRouteHandler(async ({ params, user }) => {
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { budgetSlug } = params;
    const supabase = getSupabaseServerClient();
    const supabaseAdmin = getSupabaseServerAdminClient();

    // Fetch the current budget data
    const { data: dbBudgetData, error: fetchBudgetError } = await supabase
      .from('budgets')
      .select('id, current_onboarding_step, accounts!inner(slug)')
      .eq('accounts.slug', budgetSlug!)
      .single();

    if (fetchBudgetError || !dbBudgetData) {
      console.error('Error fetching budget:', fetchBudgetError);
      return NextResponse.json(
        { error: 'Failed to fetch budget' },
        { status: 500 },
      );
    }

    if (
      !['start', 'plaid', 'manual'].includes(
        dbBudgetData.current_onboarding_step,
      )
    ) {
      return NextResponse.json(
        { error: 'Onboarding not in correct state' },
        { status: 409 },
      );
    }

    const budgetId = dbBudgetData.id;
    if (!budgetId) {
      return NextResponse.json({ error: 'Invalid budget ID' }, { status: 404 });
    }

    // Get all plaid items that have accounts linked to this budget
    const { data: plaidItems, error: plaidItemsError } = await supabaseAdmin
      .from('plaid_connection_items')
      .select(
        `
          id,
          access_token,
          next_cursor,
          plaid_accounts (
            id,
            plaid_account_id,
            meta_data,
            budget_fin_accounts (
              id,
              budget_id
            )
          )
        `,
      )
      .eq('owner_account_id', user.id)
      .eq('plaid_accounts.budget_fin_accounts.budget_id', budgetId);

    if (plaidItemsError) throw plaidItemsError;

    const plaidConnectionItems: PlaidConnectionItemSummary[] = plaidItems.map(
      (item) => ({
        svendItemId: item.id,
        accessToken: item.access_token,
        nextCursor: item.next_cursor || '',
        plaidAccounts: item.plaid_accounts.map((account) => ({
          svendAccountId: account.id,
          plaidAccountId: account.plaid_account_id,
          budgetFinAccountIds: account.budget_fin_accounts.map(ba => ba.id),
          meta_data: account.meta_data as { created_for: string } | null,
        })),
      }),
    );

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

    // Ensure all accounts are properly linked to the budget
    const linkPromises = plaidConnectionItems.flatMap(item => 
      item.plaidAccounts
        .filter(account => 
          // Only relink accounts that have budget associations and were created for a different budget
          account.budgetFinAccountIds.length > 0 && 
          account.meta_data?.created_for && 
          account.meta_data.created_for !== budgetId
        )
        .map(async account => {
          const { error: linkError } = await supabaseAdmin.rpc(
            'link_budget_plaid_account',
            {
              p_budget_id: budgetId,
              p_plaid_account_id: account.svendAccountId
            }
          );
          if (linkError) {
            console.error(`Error linking account ${account.svendAccountId} to budget:`, linkError);
          }
        })
    );

    await Promise.all(linkPromises);

    const plaidClient = new PlaidApi(plaidConfiguration);
    const transactionService = createTransactionService(supabaseAdmin);

    const { data: syncResult, error: syncError } =
      await transactionService.syncPlaidTransactions(
        plaidConnectionItems,
        plaidClient,
        budgetId,
      );

    if (syncError) throw new Error(syncError);

    return NextResponse.json({
      message: 'Plaid transactions synced successfully',
      ...syncResult,
    });
  } catch (err: any) {
    console.error('Failed to sync Plaid transactions:', err);
    return NextResponse.json(
      { error: 'Failed to sync transactions' },
      { status: 500 },
    );
  }
});
