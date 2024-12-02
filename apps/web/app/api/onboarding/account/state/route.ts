import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { createOnboardingService } from '~/lib/server/onboarding.service';
import { Budget, BudgetSpendingRecommendations, BudgetSpendingTrackingsByMonth, BudgetGoal } from '~/lib/model/budget.types';
import { Configuration } from 'plaid';
import { PlaidEnvironments } from 'plaid';
import { createBudgetService } from '~/lib/server/budget.service';
import { createCategoryService } from '~/lib/server/category.service';

// GET /api/onboarding/account/state
// Returns the current onboarding state for the account
export async function GET(request: Request) {
  const supabaseClient = getSupabaseServerClient();
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // TODO: only allow route if budget exists and is still being onboarded

  // use admin client for remaining operations
  const supabaseAdminClient = getSupabaseServerAdminClient();

  // Fetch the current onboarding state
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

  // Fetch budget goals associated with the onboarding budget
  const { data: budgetGoals, error: budgetGoalsError } = await supabaseAdminClient
    .from('budget_goals')
    .select('*')
    .eq('budget_id', budgetId);

  if (budgetGoalsError) {
    console.error('Error fetching budget goals:', budgetGoalsError);
    return NextResponse.json({ error: 'Failed to fetch budget goals' }, { status: 500 });
  }

  // Map the budget goals to match the AccountOnboardingBudgetGoal schema
  const budgetService = createBudgetService(supabaseAdminClient);
  const formattedBudgetGoals: BudgetGoal[] = budgetGoals.map(goal => budgetService.parseBudgetGoal(goal)!);

  // Fetch budget associated with the onboarding
  const { data: db_budget, error: budgetError } = await supabaseAdminClient
    .from('budgets')
    .select('*')
    .eq('id', budgetId)
    .single();

  if (budgetError) {
    console.error('Error fetching budget:', budgetError);
    return NextResponse.json({ error: 'Failed to fetch budget' }, { status: 500 });
  }

  // Map the budget to match the Budget schema
  const formattedBudget: Budget = {
    id: budgetId,
    budgetType: db_budget.budget_type,
    spendingTracking: (db_budget.spending_tracking ?? {}) as BudgetSpendingTrackingsByMonth,
    spendingRecommendations: (db_budget.spending_recommendations ?? {}) as BudgetSpendingRecommendations,
    goals: formattedBudgetGoals,
    onboardingStep: db_budget.current_onboarding_step,
    linkedFinAccounts: [],
  };

  // Fetch the financial profile for the user
  const { data: acctFinProfile, error: profileError } = await supabaseAdminClient
    .from('acct_fin_profile')
    .select('*')
    .eq('account_id', user.id)
    .single();

  if (profileError) {
    console.error('Error fetching financial profile:', profileError);
    return NextResponse.json({ error: 'Failed to fetch financial profile' }, { status: 500 });
  }

  // Map the financial profile to match the ProfileData interface
  const profileData: any = {
    fullName: acctFinProfile.full_name,
    age: acctFinProfile.age ? acctFinProfile.age.toString() : null,
    maritalStatus: acctFinProfile.marital_status,
    dependents: acctFinProfile.dependents !== null ? acctFinProfile.dependents.toString() : null,
    incomeLevel: acctFinProfile.income_level,
    savings: acctFinProfile.savings,
    currentDebt: acctFinProfile.current_debt,
    primaryFinancialGoals: acctFinProfile.primary_financial_goals,
    goalTimeline: acctFinProfile.goal_timeline,
    monthlyContribution: acctFinProfile.monthly_contribution,
    state: acctFinProfile.state,
  };

  // First, let's fetch the Plaid accounts associated with the budget
  const { data: budgetFinAccounts, error: budgetFinAccountsError } = await supabaseAdminClient
    .from('budget_fin_accounts')
    .select('id, plaid_account_id, manual_account_id')
    .eq('budget_id', budgetId);

  if (budgetFinAccountsError) {
    console.error('Error fetching budget financial accounts:', budgetFinAccountsError);
    return NextResponse.json({ error: 'Failed to fetch budget financial accounts' }, { status: 500 });
  }

  // Create a list of all plaid_accounts id's which includes all accounts for all items where any of that item's accounts are included in budgetFinAccounts
  const plaidAccountIds = new Set(budgetFinAccounts.map(account => account.plaid_account_id));

  // Fetch all items that have any of the plaid accounts in budgetFinAccounts
  const { data: relatedItems, error: relatedItemsError } = await supabaseAdminClient
    .from('plaid_accounts')
    .select('plaid_connection_items(id)')
    .in('id', Array.from(plaidAccountIds));

  if (relatedItemsError) {
    console.error('Error fetching related items:', relatedItemsError);
    return NextResponse.json({ error: 'Failed to fetch related items' }, { status: 500 });
  }

  // Fetch all plaid accounts for the related items
  const relatedItemIds = relatedItems
    .filter(item => item.plaid_connection_items?.id)
    .map(item => item.plaid_connection_items?.id as string);

  const { data: allPlaidAccounts, error: allPlaidAccountsError } = await supabaseAdminClient
    .from('plaid_accounts')
    .select('id')
    .in('plaid_conn_item_id', relatedItemIds);

  if (allPlaidAccountsError) {
    console.error('Error fetching all related Plaid accounts:', allPlaidAccountsError);
    return NextResponse.json({ error: 'Failed to fetch all related Plaid accounts' }, { status: 500 });
  }

  const allPlaidAccountIds = allPlaidAccounts.map(account => account.id);

  // Now, let's fetch the Plaid accounts and their associated items
  const { data: plaidAccounts, error: plaidAccountsError } = await supabaseAdminClient
    .from('plaid_accounts')
    .select(`
      id,
      plaid_account_id,
      plaid_persistent_account_id,
      name,
      mask,
      official_name,
      type,
      subtype,
      balance_available,
      balance_current,
      iso_currency_code,
      balance_limit,
      created_at,
      updated_at,
      plaid_connection_items (
        id,
        plaid_item_id,
        institution_name,
        institution_logo_storage_name
      )
    `)
    .in('id', allPlaidAccountIds);

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
      officialName: plaidAccount.official_name,
      accountType: plaidAccount.type,
      accountSubType: plaidAccount.subtype || '',
      balanceAvailable: plaidAccount.balance_available,
      balanceCurrent: plaidAccount.balance_current,
      isoCurrencyCode: plaidAccount.iso_currency_code,
      balanceLimit: plaidAccount.balance_limit,
      mask: plaidAccount.mask || '',
      budgetFinAccountId: budgetFinAccounts.find((account) => account.plaid_account_id === plaidAccount.id)?.id || null,
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

  const categoryService = createCategoryService(supabaseAdminClient);
  const svendCategoryGroups = await categoryService.getSvendDefaultCategoryGroups();

  return NextResponse.json({
    success: true,
    message: 'Account onboarding state successfully retrieved',
    accountOnboardingState: {
      budget: formattedBudget,
      contextKey: (dbAccountOnboardingState.account as any)?.contextKey,
      userId: user.id,
      plaidConnectionItems: plaidConnectionItems,
      profileData: profileData,
      svendCategoryGroups
    }
  });
}

// PUT /api/onboarding/account/state
// Updates the context key for the account
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

  const plaidConfiguration = new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
      },
    },
  });

  const onboardingService = createOnboardingService(supabaseAdmin, plaidConfiguration);

  try {
    const { error: updateErrorMessage } = await onboardingService.updateContextKey({
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
