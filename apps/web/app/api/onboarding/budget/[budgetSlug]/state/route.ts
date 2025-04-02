import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';
import { Configuration, PlaidEnvironments } from 'plaid';
import {
  Budget,
  BudgetGoal,
  BudgetSpendingRecommendations,
  BudgetSpendingTrackingsByMonth,
} from '~/lib/model/budget.types';
import { createBudgetService } from '~/lib/server/budget.service';
import { createCategoryService } from '~/lib/server/category.service';
import { createOnboardingService } from '~/lib/server/onboarding.service';
import manualInstitutionsStateGetter from './_helpers/manual-institutions-state-getter';
import { FinAccount } from '~/lib/model/fin.types';
import { createTransactionService } from '~/lib/server/transaction.service';

// GET /api/onboarding/budget/[budgetSlug]/state
// Returns the current onboarding state for the budget
export async function GET(
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

  // use admin client for remaining operations
  const supabaseAdminClient = getSupabaseServerAdminClient();

  console.log('Fetching budget for slug:', params.budgetSlug);
  const { data: budget, error: budgetError } = await supabaseAdminClient
    .from('budgets')
    .select(
      `
      *,
      accounts!inner (
        id,
        slug,
        name
      )
    `,
    )
    .eq('accounts.slug', params.budgetSlug)
    .single();

  if (budgetError) {
    console.error('Error fetching budget:', budgetError);
    return NextResponse.json(
      { error: 'Failed to fetch budget' },
      { status: 500 },
    );
  }

  // Continue with the rest of the code using budget.id instead of budgetId
  const budgetId = budget.id;

  // Fetch budget goals associated with the budget
  const { data: budgetGoals, error: budgetGoalsError } =
    await supabaseAdminClient
      .from('budget_goals')
      .select('*')
      .eq('budget_id', budgetId);

  if (budgetGoalsError) {
    console.error('Error fetching budget goals:', budgetGoalsError);
    return NextResponse.json(
      { error: 'Failed to fetch budget goals' },
      { status: 500 },
    );
  }

  // Map the budget goals to match the AccountOnboardingBudgetGoal schema
  const budgetService = createBudgetService(supabaseAdminClient);
  const formattedBudgetGoals: BudgetGoal[] = budgetGoals
    .map((goal) => budgetService.parseBudgetGoal(goal))
    .filter((goal): goal is BudgetGoal => goal !== null);

  // Fetch budget associated with the onboarding
  const { data: db_budget, error: dbBudgetError } = await supabaseAdminClient
    .from('budgets')
    .select('*')
    .eq('id', budgetId)
    .single();

  if (dbBudgetError) {
    console.error('Error fetching budget:', dbBudgetError);
    return NextResponse.json(
      { error: 'Failed to fetch budget' },
      { status: 500 },
    );
  }

  // First, let's fetch the Plaid accounts associated with the budget
  const { data: budgetFinAccounts, error: budgetFinAccountsError } =
    await supabaseAdminClient
      .from('budget_fin_accounts')
      .select('id, plaid_account_id, manual_account_id')
      .eq('budget_id', budgetId);

  if (budgetFinAccountsError) {
    console.error(
      'Error fetching budget financial accounts:',
      budgetFinAccountsError,
    );
    return NextResponse.json(
      { error: 'Failed to fetch budget financial accounts' },
      { status: 500 },
    );
  }

  const { manualInstitutions, error } = await manualInstitutionsStateGetter({
    supabaseAdminClient,
    budgetFinAccounts,
    user,
    budgetId,
  });

  if (error) return NextResponse.json({ error: error }, { status: 500 });

  // Create services
  const categoryService = createCategoryService(supabaseAdminClient);
  const transactionService = createTransactionService(supabaseAdminClient);

  // Fetch all Plaid items for the user directly
  const { data: userPlaidItems, error: userPlaidItemsError } =
    await supabaseAdminClient
      .from('plaid_connection_items')
      .select(
        `
        id,
        plaid_item_id,
        institution_name,
        institution_logo_storage_name,
        meta_data,
        plaid_accounts (*)
      `,
      )
      .eq('owner_account_id', user.id);

  if (userPlaidItemsError) {
    console.error('Error fetching user Plaid items:', userPlaidItemsError);
    return NextResponse.json(
      { error: 'Failed to fetch user Plaid items' },
      { status: 500 },
    );
  }

  const plaidAccounts =
    userPlaidItems?.flatMap((item) =>
      item.plaid_accounts.map((account) => ({
        ...account,
        plaid_connection_items: {
          id: item.id,
          plaid_item_id: item.plaid_item_id,
          institution_name: item.institution_name,
          institution_logo_storage_name: item.institution_logo_storage_name,
          meta_data: item.meta_data,
        },
      })),
    ) || [];

  // Fetch budget transactions via RPC
  const { data: budgetTransactions, error: budgetTxError } =
    await supabaseAdminClient.rpc(
      'get_budget_transactions_within_range_by_budget_id',
      {
        p_budget_id: budgetId,
        p_start_date: null as unknown as string,
        p_end_date: null as unknown as string,
      },
    );

  // Group accounts by their parent item
  const itemsMap = new Map();
  plaidAccounts.forEach((plaidAccount) => {
    const item = plaidAccount.plaid_connection_items as any;
    if (!itemsMap.has(item.id)) {
      itemsMap.set(item.id, {
        svendItemId: item.id,
        plaidItemId: item.plaid_item_id,
        institutionName: item.institution_name,
        institutionLogoStorageName: item.institution_logo_storage_name,
        institutionLogoSignedUrl: '',
        meta_data: item.meta_data,
        itemAccounts: [],
      });
    }
    const accountTransactions = transactionService
      .parseBudgetTransactions(budgetTransactions || [])
      .filter((tx) => {
        const budgetFinAccount = budgetFinAccounts.find(
          (acc) => acc.id === tx.budgetFinAccountId,
        );
        return budgetFinAccount?.plaid_account_id === plaidAccount.id;
      });

    itemsMap.get(item.id).itemAccounts.push({
      svendAccountId: plaidAccount.id,
      svendItemId: item.id,
      plaidAccountId: plaidAccount.plaid_account_id,
      ownerAccountId: user.id,
      accountName: plaidAccount.name,
      officialName: plaidAccount.official_name,
      accountType: plaidAccount.type,
      accountSubType: plaidAccount.subtype || '',
      balanceAvailable: plaidAccount.balance_available,
      balanceCurrent: plaidAccount.balance_current,
      isoCurrencyCode: plaidAccount.iso_currency_code,
      balanceLimit: plaidAccount.balance_limit,
      mask: plaidAccount.mask || '',
      meta_data: plaidAccount.meta_data,
      budgetFinAccountId:
        budgetFinAccounts.find(
          (account) => account.plaid_account_id === plaidAccount.id,
        )?.id || null,
      transactions: accountTransactions,
      createdAt: plaidAccount.created_at,
      updatedAt: plaidAccount.updated_at,
    });
  });

  const plaidConnectionItems = Array.from(itemsMap.values());

  console.log('Creating institution logo signed URLs...');

  // Create signed URLs for institution logos
  try {
    for (const item of plaidConnectionItems) {
      if (item.institutionLogoStorageName) {
        const { data, error: signedUrlError } =
          await supabaseAdminClient.storage
            .from(
              process.env
                .SUPABASE_STORAGE_BUCKET_PLAID_ITEM_INSTITUTION_LOGOS as string,
            )
            .createSignedUrl(item.institutionLogoStorageName, 3600);

        if (signedUrlError) {
          console.warn(
            'Error creating signed URL for institution logo:',
            signedUrlError,
          );
        } else {
          item.institutionLogoSignedUrl = data?.signedUrl || '';
          console.log(
            'Institution logo signed URL:',
            item.institutionLogoSignedUrl,
          );
        }
      }
    }
  } catch (error) {
    console.error('Error creating signed URLs for institution logos:', error);
  }

  const svendCategoryGroups =
    await categoryService.getSvendDefaultCategoryGroups();

  const linkedFinAccounts = budgetFinAccounts
    .map((budgetFinAccount) => {
      // For Plaid accounts
      if (budgetFinAccount.plaid_account_id) {
        const plaidAccount = plaidAccounts.find(
          (acc) => acc.id === budgetFinAccount.plaid_account_id,
        );
        if (!plaidAccount) return null;

        return {
          id: budgetFinAccount.plaid_account_id,
          source: 'plaid',
          institutionName: plaidAccount.plaid_connection_items.institution_name,
          budgetFinAccountId: budgetFinAccount.id,
          name: plaidAccount.name,
          mask: plaidAccount.mask || '',
          officialName: plaidAccount.official_name || '',
          balance: plaidAccount.balance_current,
        };
      }

      // For manual accounts
      if (budgetFinAccount.manual_account_id) {
        const manualAccount = manualInstitutions
          ?.flatMap((inst) => inst.accounts)
          .find((acc) => acc.id === budgetFinAccount.manual_account_id);
        if (!manualAccount) return null;

        const institution = manualInstitutions?.find((inst) =>
          inst.accounts.some((acc) => acc.id === manualAccount.id),
        );

        return {
          id: budgetFinAccount.manual_account_id,
          source: 'svend',
          budgetFinAccountId: budgetFinAccount.id,
          name: manualAccount.name,
          mask: manualAccount.mask || '',
          officialName: manualAccount.name,
          balance: manualAccount.balanceCurrent,
          institutionName: institution?.name || 'Unknown Institution',
        };
      }

      return null;
    })
    .filter((account) => account !== null)
    .sort((a, b) => {
      // First sort by source (plaid before svend)
      if (a.source !== b.source) {
        return a.source === 'plaid' ? -1 : 1;
      }

      // Then sort by institution name
      if (a.institutionName !== b.institutionName) {
        return a.institutionName.localeCompare(b.institutionName);
      }

      // Finally sort by account name
      return a.name.localeCompare(b.name);
    }) as FinAccount[];

  // Fetch the financial profile for the user
  const { data: acctFinProfile, error: profileError } =
    await supabaseAdminClient
      .from('acct_fin_profile')
      .select('*')
      .eq('account_id', user.id)
      .single();

  if (profileError) {
    console.error('Error fetching financial profile:', profileError);
    return NextResponse.json(
      { error: 'Failed to fetch financial profile' },
      { status: 500 },
    );
  }

  const formattedBudget = {
    id: db_budget.id,
    budgetType: db_budget.budget_type,
    spendingTracking: {} as BudgetSpendingTrackingsByMonth,
    spendingRecommendations: {} as BudgetSpendingRecommendations,
    goals: formattedBudgetGoals,
    onboardingStep: db_budget.current_onboarding_step,
    linkedFinAccounts: linkedFinAccounts,
    categoryGroups: svendCategoryGroups,
  };

  const profileData = {
    userId: user.id,
    financialProfile: acctFinProfile,
  };

  const budgetOnboardingState = {
    contextKey: budget.current_onboarding_step || 'start',
    budget: formattedBudget,
    userId: user.id,
    plaidConnectionItems,
    manualInstitutions,
    svendCategoryGroups,
  };

  // First, let's see what we're actually getting back
  const { data: debugData, error: debugError } = await supabaseAdminClient
    .from('budgets')
    .select(
      `
      id,
      accounts!inner (
        id,
        slug,
        name
      )
    `,
    )
    .eq('accounts.slug', params.budgetSlug);

  console.log('Debug data:', JSON.stringify(debugData, null, 2));

  return NextResponse.json({
    success: true,
    message: 'Budget onboarding state successfully retrieved',
    budgetOnboardingState,
  });
}

// PUT /api/onboarding/budget/[budgetSlug]/state
// Updates the context key for the budget
export async function PUT(
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

  const body = await request.json();
  const { contextKey, validContextKeys } = body;

  if (!contextKey || !validContextKeys.includes(contextKey)) {
    return NextResponse.json(
      { error: 'Invalid or missing contextKey' },
      { status: 400 },
    );
  }

  const supabaseAdmin = getSupabaseServerAdminClient();

  const { data: account, error: accountError } = await supabaseAdmin
    .from('accounts')
    .select('id')
    .eq('slug', params.budgetSlug)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const { data: budget, error: budgetError } = await supabaseAdmin
    .from('budgets')
    .select('id')
    .eq('team_account_id', account.id)
    .single();

  if (budgetError || !budget) {
    return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
  }

  const onboardingService = createOnboardingService(supabaseAdmin);

  try {
    const { error: updateErrorMessage } =
      await onboardingService.updateBudgetContextKey({
        budgetId: budget.id,
        contextKey,
        validContextKeys,
      });
    if (updateErrorMessage) {
      return NextResponse.json(
        { error: updateErrorMessage, contextKey: contextKey },
        { status: 409 },
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update context key:' + error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Budget context key updated successfully',
  });
}
