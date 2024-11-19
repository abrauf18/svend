import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { Configuration, PlaidApi, PlaidEnvironments, TransactionsSyncRequest } from 'plaid';
import { SupabaseClient } from '@supabase/supabase-js';

import { createAccountOnboardingService } from '~/lib/server/onboarding.service';
import { createCategoryService } from '~/lib/server/category.service';
import { BudgetRecommendation, createBudgetService } from '~/lib/server/budget.service';
import { FinAccountTransaction } from '~/lib/model/fin.types';
import { BudgetGoal } from '~/lib/model/budget.types';
import { Database } from '~/lib/database.types';

// POST /api/onboarding/account/budget/analysis
// Perform budget spending analysis
export async function POST(request: Request) {
  const supabaseClient = getSupabaseServerClient();
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // use admin client for remaining operations
  const supabaseAdminClient = getSupabaseServerAdminClient();

  // Fetch the current onboardingstate
  const { data: dbAccountOnboardingState, error: fetchOnboardingError } = await supabaseAdminClient
    .from('onboarding')
    .select('state->account')
    .eq('account_id', user.id)
    .single();

  if (fetchOnboardingError) {
    console.error('POST /api/onboarding/account/budget/analysis - Error fetching onboarding state:', fetchOnboardingError);
    return NextResponse.json({ error: 'Failed to fetch onboarding state' }, { status: 500 });
  }

  const startingContextKey = (dbAccountOnboardingState.account as any)?.contextKey;
  if (startingContextKey !== 'analyze_spending') {
    if (startingContextKey === 'analyze_spending_in_progress') {
      return NextResponse.json({ error: 'Already analyzing spending' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Invalid state: ' + startingContextKey }, { status: 400 });
  }

  const onboardingService = createAccountOnboardingService();

  // update the context key to analyze_spending_in_progress
  try {
    const updateErrorMessage = await onboardingService.updateContextKey({
      supabase: supabaseAdminClient,
      userId: user.id,
      contextKey: 'analyze_spending_in_progress',
      validContextKeys: ['profile_goals', 'analyze_spending', 'analyze_spending_in_progress', 'budget_setup', 'end']
    });
    if (updateErrorMessage) {
      console.error('POST /api/onboarding/account/budget/analysis - Error updating context key to analyze_spending_in_progress:', updateErrorMessage);
      return NextResponse.json({ error: updateErrorMessage }, { status: 500 });
    }
  } catch (error: any) {
    console.error('POST /api/onboarding/account/budget/analysis - Failed to update context key to analyze_spending_in_progress:', error.message);
    return NextResponse.json({ error: 'Failed to update context key:' + error.message }, { status: 500 });
  }

  const budgetId = (dbAccountOnboardingState.account as any)?.budgetId;

  // Fetch Plaid connection items and accounts
  const { itemSummaries, error } = await fetchPlaidConnectionItemSummaries(supabaseAdminClient, budgetId);
  if (error) {
    console.error('POST /api/onboarding/account/budget/analysis - Error fetching Plaid connection items:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!itemSummaries) {
    console.error('POST /api/onboarding/account/budget/analysis - Error fetching Plaid connection items');

    // rollback the context key to analyze_spending
    try {
      const updateErrorMessage = await onboardingService.updateContextKey({
        supabase: supabaseAdminClient,
        userId: user.id,
        contextKey: 'analyze_spending',
        validContextKeys: ['profile_goals', 'analyze_spending', 'analyze_spending_in_progress', 'budget_setup', 'end']
      });
      if (updateErrorMessage) {
        console.error('POST /api/onboarding/account/budget/analysis - Error rolling back context key to analyze_spending:', updateErrorMessage);
        return NextResponse.json({ error: updateErrorMessage }, { status: 500 });
      }
    } catch (error: any) {
      console.error('POST /api/onboarding/account/budget/analysis - Failed to rollback context key to analyze_spending:', error.message);
      return NextResponse.json({ error: 'Failed to rollback context key:' + error.message }, { status: 500 });
    }

    return NextResponse.json({ error: 'Failed to fetch Plaid connection items' }, { status: 500 });
  }

  // Perform budget analysis
  const { budgetRecommendations, errorMessage } = await budgetAnalysis(budgetId, itemSummaries, supabaseAdminClient);
  if (errorMessage) {
    console.error('POST /api/onboarding/account/budget/analysis - Error during budget analysis:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }

  // debug
  // console.log('budgetRecommendations', budgetRecommendations);

  // Update the budget with analysis results
  // TODO: update to transaction via function
  const { error: updateBudgetError } = await supabaseAdminClient
    .from('budgets')
    .update({
      recommended_category_spending: {
        balanced: budgetRecommendations?.balanced?.spending,
        conservative: budgetRecommendations?.conservative?.spending,
        relaxed: budgetRecommendations?.relaxed?.spending
      },
      category_spending: budgetRecommendations?.balanced?.spending
    })
    .eq('id', budgetId);

  if (updateBudgetError) {
    console.error('POST /api/onboarding/account/budget/analysis - Error updating budget with analysis results:', updateBudgetError);

    // rollback the context key to analyze_spending
    try {
      const updateErrorMessage = await onboardingService.updateContextKey({
        supabase: supabaseAdminClient,
        userId: user.id,
        contextKey: 'analyze_spending',
        validContextKeys: ['profile_goals', 'analyze_spending', 'analyze_spending_in_progress', 'budget_setup', 'end']
      });
      if (updateErrorMessage) {
        console.error('POST /api/onboarding/account/budget/analysis - Error rolling back context key to analyze_spending:', updateErrorMessage);
        return NextResponse.json({ error: updateErrorMessage }, { status: 500 });
      }
    } catch (error: any) {
      console.error('POST /api/onboarding/account/budget/analysis - Failed to rollback context key to analyze_spending:', error.message);
      return NextResponse.json({ error: 'Failed to rollback context key:' + error.message }, { status: 500 });
    }

    return NextResponse.json({ error: 'Failed to update budget with analysis results' }, { status: 500 });
  }

  // TODO: update to transaction via function
  for (const [goalId, trackingData] of Object.entries(budgetRecommendations?.balanced?.goalTrackings || [])) {
    const { error: updateTrackingError } = await supabaseAdminClient
      .from('budget_goals')
      .update({
        tracking: trackingData
      })
      .eq('id', goalId);

    if (updateTrackingError) {
      console.error('POST /api/onboarding/account/budget/analysis - Error updating budget goals tracking field:', updateTrackingError);

      // rollback the context key to analyze_spending
      try {
        const updateErrorMessage = await onboardingService.updateContextKey({
          supabase: supabaseAdminClient,
          userId: user.id,
          contextKey: 'analyze_spending',
          validContextKeys: ['profile_goals', 'analyze_spending', 'analyze_spending_in_progress', 'budget_setup', 'end']
        });
        if (updateErrorMessage) {
          console.error('POST /api/onboarding/account/budget/analysis - Error rolling back context key to analyze_spending:', updateErrorMessage);
          return NextResponse.json({ error: updateErrorMessage }, { status: 500 });
        }
      } catch (error: any) {
        console.error('POST /api/onboarding/account/budget/analysis - Failed to rollback context key to analyze_spending:', error.message);
        return NextResponse.json({ error: 'Failed to rollback context key:' + error.message }, { status: 500 });
      }

      return NextResponse.json({ error: 'Failed to update budget goals tracking field' }, { status: 500 });
    }
  }

  // update the context key to budget_setup
  try {
    const updateErrorMessage = await onboardingService.updateContextKey({
      supabase: supabaseAdminClient,
      userId: user.id,
      contextKey: 'budget_setup',
      validContextKeys: ['profile_goals', 'analyze_spending', 'analyze_spending_in_progress', 'budget_setup', 'end']
    });
    if (updateErrorMessage) {
      console.error('POST /api/onboarding/account/budget/analysis - Error updating context key to budget_setup:', updateErrorMessage);
      return NextResponse.json({ error: updateErrorMessage }, { status: 500 });
    }
  } catch (error: any) {
    console.error('POST /api/onboarding/account/budget/analysis - Failed to update context key to budget_setup:', error.message);
    return NextResponse.json({ error: 'Failed to update context key:' + error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Budget analysis completed successfully',
    analysisResult: budgetRecommendations
  });
}

type PlaidConnectionItemSummary = {
  svendItemId: string;
  accessToken: string;
  nextCursor: string;
};

async function fetchPlaidConnectionItemSummaries(
  supabaseAdminClient: SupabaseClient<Database>,
  budgetId: string
): Promise<{ itemSummaries: PlaidConnectionItemSummary[]; error: Error | null }> {
  console.log('Fetching Plaid connection item IDs for budgetId:', budgetId);

  // Fetch the Plaid account IDs associated with the budget directly
  const { data: budgetFinAccounts, error: budgetFinAccountsError } = await supabaseAdminClient
    .from('budget_fin_accounts')
    .select('plaid_account_id')
    .eq('budget_id', budgetId);

  if (budgetFinAccountsError) {
    console.error('Error fetching budget financial accounts:', budgetFinAccountsError);
    return { itemSummaries: [], error: new Error('Failed to fetch budget financial accounts') };
  }

  // Extract the plaid account IDs
  const plaidAccountIds = budgetFinAccounts.map(account => account.plaid_account_id);

  console.log('plaidAccountIds', plaidAccountIds);

  // Get the plaid_conn_item_ids from the accounts
  const { data: plaidAccounts, error: plaidAccountsError } = await supabaseAdminClient
    .from('plaid_accounts')
    .select('plaid_conn_item_id')
    .in('id', plaidAccountIds);

  if (plaidAccountsError) {
    console.error('Error fetching Plaid accounts:', plaidAccountsError);
    return { itemSummaries: [], error: new Error('Failed to fetch Plaid accounts') };
  }

  // Get unique item IDs
  const uniqueItemIds = [...new Set(plaidAccounts.map(acc => acc.plaid_conn_item_id))];

  // Fetch the connection items directly
  const { data: plaidConnectionItems, error: plaidConnectionItemsError } = await supabaseAdminClient
    .from('plaid_connection_items')
    .select('id, access_token, next_cursor')
    .in('id', uniqueItemIds);

  if (plaidConnectionItemsError) {
    console.error('Error fetching Plaid connection items:', plaidConnectionItemsError);
    return { itemSummaries: [], error: new Error('Failed to fetch Plaid connection items') };
  }

  // Map to the expected format
  const itemSummaries = plaidConnectionItems.map(item => ({
    svendItemId: item.id,
    accessToken: item.access_token,
    nextCursor: item.next_cursor
  })) as PlaidConnectionItemSummary[];

  return { itemSummaries, error: null };
}

// fetch/persist transactions and analyze spending
async function budgetAnalysis(budgetId: string, plaidConnectionItems: PlaidConnectionItemSummary[], supabase: SupabaseClient<Database>): Promise<{ budgetRecommendations: Record<string, BudgetRecommendation> | null, errorMessage: string | null }> {
  console.log('plaidConnectionItems', plaidConnectionItems);

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

  const categorySpending: Record<string, number> = {};
  const itemCursors: Record<string, string> = {};

  // Track all transactions with their dates
  const allTransactions: Array<FinAccountTransaction> = [];
  const newTransactions: Array<FinAccountTransaction> = [];

  for (const item of plaidConnectionItems) {
    const accessToken = item.accessToken;

    // Fetch existing transactions from the database
    const { data: plaidAccountIds } = await supabase
      .from('plaid_accounts')
      .select('id, plaid_account_id')
      .eq('plaid_conn_item_id', item.svendItemId);

    const { data: existingTransactions, error: fetchError } = await supabase
      .from('fin_account_transactions')
      .select('*')
      .in('plaid_account_id', plaidAccountIds?.map(account => account.id) || []);

    if (fetchError) {
      console.error('Error fetching existing transactions:', fetchError);
      return {
        budgetRecommendations: null,
        errorMessage: `Failed to fetch existing transactions: ${fetchError.message}`
      };
    }

    // Analyze existing transactions
    for (const transaction of existingTransactions) {
      const plaidCategory = transaction.plaid_category_detailed;
      if (plaidCategory) {
        const amount = transaction.amount;
        categorySpending[plaidCategory] = (categorySpending[plaidCategory] || 0) + amount;
        allTransactions.push({
          date: transaction.date,
          amount: amount,
          plaidDetailedCategoryName: plaidCategory,
        } as FinAccountTransaction);
      }
    }

    let nextCursor = item.nextCursor;
    let hasMore = true;

    while (hasMore) {
      const request: TransactionsSyncRequest = {
        access_token: accessToken as string,
        cursor: nextCursor,
      };

      try {
        const response = await plaidClient.transactionsSync(request);
        const transactions = response.data.added;

        // Analyze new transactions
        for (const transaction of transactions) {
          const plaidCategory = transaction.personal_finance_category?.detailed
          if (plaidCategory) {
            const amount = transaction.amount;
            categorySpending[plaidCategory] = (categorySpending[plaidCategory] || 0) + amount;
            newTransactions.push({
              date: transaction.date,
              amount: amount,
              plaidDetailedCategoryName: plaidCategory,
              plaidAccountId: plaidAccountIds?.find(accountIds => accountIds.plaid_account_id === transaction.account_id)?.id,
              merchantName: transaction.merchant_name ?? '',
              payee: transaction.payment_meta?.payee ?? '',
              isoCurrencyCode: transaction.iso_currency_code,
              rawData: transaction,
            } as FinAccountTransaction);
          }
        }

        hasMore = response.data.has_more;
        nextCursor = response.data.next_cursor;
      } catch (error: any) {
        return {
          budgetRecommendations: null,
          errorMessage: `Failed to sync transactions: ${error.message}`
        };
      }
    }

    // Update the next_cursor for the Plaid item in the database
    itemCursors[item.svendItemId] = nextCursor;
  }

  // Sort transactions by date in ascending order
  allTransactions.push(...newTransactions);

  const categoryService = createCategoryService(getSupabaseServerClient());

  // Map categories to svend category IDs
  const plaidDetailedCategories = allTransactions.map(transaction => transaction.plaidDetailedCategoryName) as string[];
  const svendCategories = await categoryService.mapPlaidCategoriesToSvendCategories(plaidDetailedCategories);
  const allTransactionsUpdated = allTransactions.map(transaction => {
    return {
      ...transaction,
      svendCategoryId: svendCategories[transaction.plaidDetailedCategoryName as string]?.id,
      svendCategoryName: svendCategories[transaction.plaidDetailedCategoryName as string]?.name,
    }
  });
  allTransactionsUpdated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const newTransactionsToPersist = allTransactionsUpdated.slice(allTransactionsUpdated.length - newTransactions.length);
  console.log(`persisting ${newTransactionsToPersist.length} new transactions..`);

  // Persist transactions to fin_account_transactions table
  let errorMessage = await persistTransactions(newTransactionsToPersist);
  if (errorMessage) {
    return {
      budgetRecommendations: null,
      errorMessage: errorMessage
    };
  }
  
  // update the next_cursor for the Plaid items in the database
  for (const item of plaidConnectionItems) {
    const { error: updateError } = await supabase
    .from('plaid_connection_items')
    .update({ next_cursor: itemCursors[item.svendItemId] })
    .eq('id', item.svendItemId);
    
    if (updateError) {
      console.error('Error updating next_cursor:', updateError);
      return {
        budgetRecommendations: null,
        errorMessage: `Failed to update next_cursor for item ${item.svendItemId}: ${updateError.message}`
      };
    }
  }
  
  // update categorySpending to use svend category names as keys
  const categorySpendingUpdated: Record<string, number> = Object.fromEntries(Object.entries(categorySpending).map(([category, amount]) => [svendCategories[category]?.name, amount]));

  // enhance the category spending with recommendations and targets
  const { data: dbBudgetGoals, error: goalsError } = await supabase
    .from('budget_goals')
    .select('*')
    .eq('budget_id', budgetId);

  if (goalsError) {
    console.error('Error fetching budget goals:', goalsError);
    return {
      budgetRecommendations: null,
      errorMessage: `Failed to fetch budget goals: ${goalsError.message}`
    };
  }

  const budgetService = createBudgetService(getSupabaseServerClient());

  const validBudgetGoals = dbBudgetGoals
    .map(goal => budgetService.parseBudgetGoal(goal))
    .filter((goal): goal is BudgetGoal => goal !== null);

  if (validBudgetGoals.length !== dbBudgetGoals.length) {
    console.warn('Invalid budget goals found:', dbBudgetGoals.filter((goal): goal is Database['public']['Tables']['budget_goals']['Row'] => goal !== null));
  }

  const budgetRecommendations = await budgetService.recommendSpendingAndGoals(
    allTransactionsUpdated,
    categorySpendingUpdated,
    validBudgetGoals,
    budgetId
  );

  return {
    budgetRecommendations,
    errorMessage: null
  };
}


async function persistTransactions(transactions: FinAccountTransaction[]) {
  const supabaseAdminClient = getSupabaseServerAdminClient();
  const BATCH_SIZE = 100;

  try {
    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE);
      const transactionsToInsert = batch.map((transaction) => ({
        plaid_account_id: transaction.plaidAccountId,
        amount: transaction.amount,
        iso_currency_code: transaction.isoCurrencyCode,
        plaid_category_detailed: transaction.plaidDetailedCategoryName,
        plaid_category_confidence: transaction.plaidCategoryConfidence,
        svend_category_id: transaction.svendCategoryId as string,
        date: transaction.date,
        merchant_name: transaction.merchantName,
        payee: transaction.payee,
        notes: transaction.notes,
        raw_data: transaction.rawData
      }));

      console.log(`Persisting batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(transactions.length / BATCH_SIZE)}`);

      const { error } = await supabaseAdminClient
        .from('fin_account_transactions')
        .insert(transactionsToInsert);

      if (error) {
        console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, error);
        return `Failed to persist transactions batch ${i / BATCH_SIZE + 1}: ${error.message}`;
      }

      // Log memory usage
      const memoryUsage = process.memoryUsage();
      console.log(`Memory Usage: RSS: ${memoryUsage.rss}, Heap Total: ${memoryUsage.heapTotal}, Heap Used: ${memoryUsage.heapUsed}`);

      // Add a small delay between batches to prevent overwhelming the database
      if (i + BATCH_SIZE < transactions.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return null; // success
  } catch (error: any) {
    console.error('Error in persistTransactions:', error);
    return `Failed to persist transactions: ${error.message}`;
  }
}
