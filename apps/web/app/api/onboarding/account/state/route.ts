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

// GET /api/onboarding/account/state
// Returns the current onboarding state for the account
export async function GET(request: Request) {
  const supabaseClient = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // TODO: only allow route if budget exists and is still being onboarded

  // use admin client for remaining operations
  const supabaseAdminClient = getSupabaseServerAdminClient();

  // Fetch the current onboarding state
  const { data: dbAccountOnboardingState, error: fetchOnboardingError } =
    await supabaseAdminClient
      .from('user_onboarding')
      .select('state->account')
      .eq('user_id', user.id)
      .single();

  if (fetchOnboardingError) {
    console.error('Error fetching onboarding state:', fetchOnboardingError);
    return NextResponse.json(
      { error: 'Failed to fetch onboarding state' },
      { status: 500 },
    );
  }

  const budgetId = (dbAccountOnboardingState.account as any)?.budgetId;

  // Fetch budget goals associated with the onboarding budget
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
  const { data: db_budget, error: budgetError } = await supabaseAdminClient
    .from('budgets')
    .select('*')
    .eq('id', budgetId)
    .single();

  if (budgetError) {
    console.error('Error fetching budget:', budgetError);
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

  // Fetch all Plaid items for the user directly
  const { data: userPlaidItems, error: userPlaidItemsError } = 
    await supabaseAdminClient
      .from('plaid_connection_items')
      .select(`
        id,
        plaid_item_id,
        institution_name,
        institution_logo_storage_name,
        plaid_accounts (*)
      `)
      .eq('owner_account_id', user.id);

  if (userPlaidItemsError) {
    console.error('Error fetching user Plaid items:', userPlaidItemsError);
    return NextResponse.json(
      { error: 'Failed to fetch user Plaid items' },
      { status: 500 },
    );
  }

  const plaidAccounts = userPlaidItems?.flatMap(item => 
    item.plaid_accounts.map(account => ({
      ...account,
      plaid_connection_items: {
        id: item.id,
        plaid_item_id: item.plaid_item_id,
        institution_name: item.institution_name,
        institution_logo_storage_name: item.institution_logo_storage_name
      }
    }))
  ) || [];

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
        itemAccounts: [],
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
      budgetFinAccountId:
        budgetFinAccounts.find(
          (account) => account.plaid_account_id === plaidAccount.id,
        )?.id || null,
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

  const categoryService = createCategoryService(supabaseAdminClient);
  const svendCategoryGroups =
    await categoryService.getSvendDefaultCategoryGroups();

  const linkedFinAccounts = budgetFinAccounts
    .map(budgetFinAccount => {
      // For Plaid accounts
      if (budgetFinAccount.plaid_account_id) {
        const plaidAccount = plaidAccounts.find(acc => acc.id === budgetFinAccount.plaid_account_id);
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
        const manualAccount = manualInstitutions?.flatMap(inst => inst.accounts)
          .find(acc => acc.id === budgetFinAccount.manual_account_id);
        if (!manualAccount) return null;

        const institution = manualInstitutions?.find(
          inst => inst.accounts.some(acc => acc.id === manualAccount.id)
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
    .filter(account => account !== null)
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

  // Map the budget to match the Budget schema
  const formattedBudget: Budget = {
    id: budgetId,
    budgetType: db_budget.budget_type,
    spendingTracking: (db_budget.spending_tracking ??
      {}) as BudgetSpendingTrackingsByMonth,
    spendingRecommendations: (db_budget.spending_recommendations ??
      {}) as BudgetSpendingRecommendations,
    goals: formattedBudgetGoals,
    onboardingStep: db_budget.current_onboarding_step,
    linkedFinAccounts,
  };

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

  // Map the financial profile to match the ProfileData interface
  const profileData: any = {
    fullName: acctFinProfile.full_name,
    age: acctFinProfile.age ? acctFinProfile.age.toString() : null,
    maritalStatus: acctFinProfile.marital_status,
    dependents:
      acctFinProfile.dependents !== null
        ? acctFinProfile.dependents.toString()
        : null,
    incomeLevel: acctFinProfile.income_level,
    savings: acctFinProfile.savings,
    currentDebt: acctFinProfile.current_debt,
    primaryFinancialGoals: acctFinProfile.primary_financial_goals,
    goalTimeline: acctFinProfile.goal_timeline,
    monthlyContribution: acctFinProfile.monthly_contribution,
    state: acctFinProfile.state,
  };

  return NextResponse.json({
    success: true,
    message: 'Account onboarding state successfully retrieved',
    accountOnboardingState: {
      budget: formattedBudget,
      contextKey: (dbAccountOnboardingState.account as any)?.contextKey,
      userId: user.id,
      plaidConnectionItems,
      profileData,
      svendCategoryGroups,
      manualInstitutions,
    },
  });
}

// PUT /api/onboarding/account/state
// Updates the context key for the account
export async function PUT(request: Request) {
  const supabase = getSupabaseServerClient();

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { contextKey, validContextKeys } = body;

  // TODO: validate contextKey transition

  if (!contextKey || !validContextKeys.includes(contextKey)) {
    return NextResponse.json(
      { error: 'Invalid or missing contextKey' },
      { status: 400 },
    );
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

  const onboardingService = createOnboardingService(
    supabaseAdmin,
    plaidConfiguration,
  );

  try {
    const { error: updateErrorMessage } =
      await onboardingService.updateContextKey({
        userId: user.id,
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
    message: 'Context key updated successfully',
  });
}
