import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';
import { createCategoryService } from '~/lib/server/category.service';
import { createBudgetService } from '~/lib/server/budget.service';

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Get the budget with its linked accounts
    const { data: budgets, error: budgetsError } = await supabase
      .from('budgets')
      .select(`
        *,
        accounts (
          name
        ),
        budget_fin_accounts(
          id,
          plaid_account_id,
          manual_account_id
        )
      `);

    if (budgetsError) throw budgetsError;

    // 2. Get all Plaid accounts for the user
    const { data: plaidAccounts, error: plaidAccountsError } = await supabase
      .from('plaid_accounts')
      .select(`
        *,
        plaid_connection_items (
          id,
          plaid_item_id,
          institution_name,
          institution_logo_storage_name
        )
      `);

    if (plaidAccountsError) throw plaidAccountsError;

    // 3. Get all manual accounts for the user
    const { data: manualInstitutions, error: manualInstitutionsError } = await supabase
      .from('manual_fin_institutions')
      .select(`
        *,
        manual_fin_accounts (
          id,
          name,
          type,
          mask,
          balance_current,
          fin_account_transactions (
            id,
            date,
            amount,
            merchant_name,
            svend_category_id,
            user_tx_id,
            tx_status,
            manual_account_id
          )
        )
      `)
      .eq('owner_account_id', user.id);

    if (manualInstitutionsError) throw manualInstitutionsError;

    // Transform the linked accounts (both Plaid and manual)
    const linkedFinAccounts = [
      // Plaid accounts
      ...plaidAccounts
        .filter(account => budgets?.some(budget => 
          budget.budget_fin_accounts.some(bfa => bfa.plaid_account_id === account.id)
        ))
        .map(account => ({
          id: account.id,
          source: 'plaid',
          type: account.type ?? 'other',
          institutionName: account.plaid_connection_items?.institution_name ?? '',
          budgetFinAccountIds: budgets?.flatMap(budget => 
            budget.budget_fin_accounts
              .filter(bfa => bfa.plaid_account_id === account.id)
              .map(bfa => bfa.id)
          ) ?? [],
          name: account.name ?? '',
          mask: account.mask ?? '',
          officialName: account.official_name ?? '',
          balance: account.balance_current ?? 0,
          balanceCurrent: account.balance_current ?? 0,
          budgetFinAccountId: budgets?.find(budget => 
            budget.budget_fin_accounts.some(bfa => bfa.plaid_account_id === account.id)
          )?.budget_fin_accounts.find(bfa => bfa.plaid_account_id === account.id)?.id
        })),
      // Manual accounts
      ...(manualInstitutions ?? []).flatMap(inst => 
        inst.manual_fin_accounts
          .filter(account => budgets?.some(budget =>
            budget.budget_fin_accounts.some(bfa => bfa.manual_account_id === account.id)
          ))
          .map(account => ({
            id: account.id,
            source: 'svend',
            type: account.type ?? 'other',
            institutionName: inst.name ?? '',
            budgetFinAccountIds: budgets?.flatMap(budget =>
              budget.budget_fin_accounts
                .filter(bfa => bfa.manual_account_id === account.id)
                .map(bfa => bfa.id)
            ) ?? [],
            name: account.name ?? '',
            mask: account.mask ?? '',
            officialName: account.name ?? '',
            balance: account.balance_current ?? 0,
            balanceCurrent: account.balance_current ?? 0,
            budgetFinAccountId: budgets?.find(budget => 
              budget.budget_fin_accounts.some(bfa => bfa.manual_account_id === account.id)
            )?.budget_fin_accounts.find(bfa => bfa.manual_account_id === account.id)?.id
          }))
      )
    ];

    // Group Plaid accounts by item
    const plaidConnectionItems = Object.values(
      plaidAccounts.reduce((acc, account) => {
        const itemId = account.plaid_connection_items?.id;
        if (!itemId) return acc;

        if (!acc[itemId]) {
          acc[itemId] = {
            svendItemId: itemId,
            plaidItemId: account.plaid_connection_items?.plaid_item_id ?? '',
            institutionName: account.plaid_connection_items?.institution_name ?? '',
            institutionLogoUrl: account.plaid_connection_items?.institution_logo_storage_name 
              ? `/storage/${account.plaid_connection_items.institution_logo_storage_name}`
              : '',
            itemAccounts: []
          };
        }

        acc[itemId].itemAccounts.push({
          svendAccountId: account.id,
          svendItemId: itemId,
          accountName: account.name ?? '',
          accountType: account.type ?? 'other',
          mask: account.mask ?? '',
          balanceCurrent: account.balance_current ?? 0,
          budgetFinAccountIds: budgets?.flatMap(budget =>
            budget.budget_fin_accounts
              .filter(bfa => bfa.plaid_account_id === account.id)
              .map(bfa => bfa.id)
          ) ?? []
        });

        return acc;
      }, {} as Record<string, any>)
    );

    // Transform the manual institutions to the expected format
    const transformedManualInstitutions = manualInstitutions?.map(inst => ({
      id: inst.id,
      name: inst.name,
      symbol: inst.symbol,
      accounts: inst.manual_fin_accounts.map(acc => ({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        mask: acc.mask,
        balanceCurrent: acc.balance_current,
        budgetFinAccountIds: budgets?.flatMap(budget =>
          budget.budget_fin_accounts
            .filter(bfa => bfa.manual_account_id === acc.id)
            .map(bfa => bfa.id)
        ) ?? [],
        transactions: acc.fin_account_transactions.map(tx => ({
          id: tx.id,
          date: tx.date,
          amount: tx.amount,
          merchantName: tx.merchant_name,
          svendCategoryId: tx.svend_category_id,
          userTxId: tx.user_tx_id,
          status: tx.tx_status,
          manualAccountId: acc.id
        }))
      }))
    }));

    const supabaseAdminClient = getSupabaseServerAdminClient();

    // Fetch budget goals associated with the budgets
    const { data: budgetGoals, error: budgetGoalsError } =
      await supabaseAdminClient
        .from('budget_goals')
        .select('*')
        .in('budget_id', budgets?.map(b => b.id) ?? []);

    if (budgetGoalsError) {
      console.error('Error fetching budget goals:', budgetGoalsError);
      throw budgetGoalsError;
    }

    // Fetch budget_fin_accounts to get the mapping between budgetFinAccountId and actual account IDs
    const { data: budgetFinAccountsMapping, error: mappingError } = 
      await supabaseAdminClient
        .from('budget_fin_accounts')
        .select('id, plaid_account_id, manual_account_id, budget_id')
        .in('budget_id', budgets?.map(b => b.id) ?? []);

    if (mappingError) {
      console.error('Error fetching budget fin accounts mapping:', mappingError);
      throw mappingError;
    }

    // Map the budget goals to match the BudgetGoal schema
    const budgetService = createBudgetService(supabaseAdminClient);
    const formattedBudgetGoals = budgetGoals
      .map((goal) => {
        const parsedGoal = budgetService.parseBudgetGoal(goal);
        if (!parsedGoal) return null;
        
        // Find the associated account ID (either Plaid or manual)
        const accountMapping = budgetFinAccountsMapping.find(
          mapping => mapping.id === parsedGoal.budgetFinAccountId
        );
        
        if (accountMapping) {
          return {
            ...parsedGoal,
            plaidAccountId: accountMapping.plaid_account_id ?? undefined,
            manualAccountId: accountMapping.manual_account_id ?? undefined
          };
        }
        
        return parsedGoal;
      })
      .filter((goal) => goal !== null);

    const categoryService = createCategoryService(supabaseAdminClient);
    const svendCategoryGroups =
      await categoryService.getSvendDefaultCategoryGroups();

    // Transform response to handle array of budgets
    const response = {
      account: {
        budgets: budgets?.map(budget => ({
          id: budget.id,
          budgetType: budget.budget_type,
          name: budget.accounts?.name,
          spendingTracking: budget.spending_tracking ?? {},
          spendingRecommendations: budget.spending_recommendations ?? {},
          linkedFinAccounts: linkedFinAccounts.filter(account => 
            budget.budget_fin_accounts.some(bfa => 
              (bfa.plaid_account_id === account.id && account.source === 'plaid') ||
              (bfa.manual_account_id === account.id && account.source === 'svend')
            )
          ),
          goals: formattedBudgetGoals.filter(goal => goal.budgetId === budget.id)
        })) ?? [],
        userId: user.id,
        contextKey: 'plaid',
        plaidConnectionItems,
        manualInstitutions: transformedManualInstitutions ?? [],
        svendCategoryGroups
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching fin account state:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fin account state' },
      { status: 500 }
    );
  }
}