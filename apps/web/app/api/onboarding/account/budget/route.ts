import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { Configuration, PlaidApi, PlaidEnvironments, Transaction, TransactionsSyncRequest } from 'plaid';
import { AccountOnboardingPlaidConnectionItem } from '@kit/accounts/components';
import { SupabaseClient } from '@supabase/supabase-js';
import { createAccountOnboardingService } from '~/lib/server/onboarding.service';

// Perform budge spending analysis
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
    console.error('Error fetching onboarding state:', fetchOnboardingError);
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
      return NextResponse.json({ error: updateErrorMessage }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to update context key:' + error.message }, { status: 500 });
  }

  const budgetId = (dbAccountOnboardingState.account as any)?.budgetId;

  // Fetch Plaid connection items and accounts
  const plaidConnectionItems = await fetchPlaidConnectionItems(supabaseAdminClient, budgetId, user.id);

  if (!plaidConnectionItems) {
    console.error('Error fetching Plaid connection items');

    // rollback the context key to analyze_spending
    try {
      const updateErrorMessage = await onboardingService.updateContextKey({
        supabase: supabaseAdminClient,
        userId: user.id,
        contextKey: 'analyze_spending',
        validContextKeys: ['profile_goals', 'analyze_spending', 'analyze_spending_in_progress', 'budget_setup', 'end']
      });
      if (updateErrorMessage) {
        return NextResponse.json({ error: updateErrorMessage }, { status: 500 });
      }
    } catch (error: any) {
      return NextResponse.json({ error: 'Failed to rollback context key:' + error.message }, { status: 500 });
    }

    return NextResponse.json({ error: 'Failed to fetch Plaid connection items' }, { status: 500 });
  }

  // Perform budget analysis
  const analysisResult = await budgetAnalysis(plaidConnectionItems, supabaseAdminClient);
  if (analysisResult.errorMessage) {
    return NextResponse.json({ error: analysisResult.errorMessage }, { status: 500 });
  }

  // Update the budget with analysis results
  const { error: updateBudgetError } = await supabaseAdminClient
    .from('budgets')
    .update({ category_spending: analysisResult.categorySpending })
    .eq('id', budgetId);

  if (updateBudgetError) {
    console.error('Error updating budget with analysis results:', updateBudgetError);

    // rollback the context key to analyze_spending
    try {
      const updateErrorMessage = await onboardingService.updateContextKey({
        supabase: supabaseAdminClient,
        userId: user.id,
        contextKey: 'analyze_spending',
        validContextKeys: ['profile_goals', 'analyze_spending', 'analyze_spending_in_progress', 'budget_setup', 'end']
      });
      if (updateErrorMessage) {
        return NextResponse.json({ error: updateErrorMessage }, { status: 500 });
      }
    } catch (error: any) {
      return NextResponse.json({ error: 'Failed to rollback context key:' + error.message }, { status: 500 });
    }

    return NextResponse.json({ error: 'Failed to update budget with analysis results' }, { status: 500 });
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
      return NextResponse.json({ error: updateErrorMessage }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to update context key:' + error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Budget analysis completed successfully',
    analysisResult
  });
}

async function fetchPlaidConnectionItems(supabaseAdminClient: SupabaseClient, budgetId: string, userId: string) {
  console.log('Fetching Plaid connection items for budgetId:', budgetId, 'userId:', userId);

  // Fetch the Plaid accounts associated with the budget
  const { data: budgetPlaidAccounts, error: budgetPlaidAccountsError } = await supabaseAdminClient
    .from('budget_plaid_accounts')
    .select('plaid_account_id')
    .eq('budget_id', budgetId);

  if (budgetPlaidAccountsError) {
    console.error('Error fetching budget Plaid accounts:', budgetPlaidAccountsError);
    return null;
  }

  console.log('Budget Plaid accounts:', budgetPlaidAccounts);

  if (!budgetPlaidAccounts || budgetPlaidAccounts.length === 0) {
    console.log('No Plaid accounts found for this budget');
    return null;
  }

  // Fetch the Plaid accounts and their associated items
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
        institution_logo_storage_name,
        access_token,
        next_cursor
      )
    `)
    .in('id', budgetPlaidAccounts.map(account => account.plaid_account_id));

  if (plaidAccountsError) {
    console.error('Error fetching Plaid accounts:', plaidAccountsError);
    return null;
  }

  console.log('Plaid accounts:', plaidAccounts);

  if (!plaidAccounts || plaidAccounts.length === 0) {
    console.log('No Plaid accounts found');
    return null;
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
        accessToken: item.access_token,
        nextCursor: item.next_cursor,
        itemAccounts: []
      });
    }
    itemsMap.get(item.id).itemAccounts.push({
      svendAccountId: plaidAccount.id,
      svendItemId: item.id,
      plaidAccountId: plaidAccount.plaid_account_id,
      ownerAccountId: userId,
      accountName: plaidAccount.name,
      accountType: plaidAccount.type,
      accountSubType: plaidAccount.subtype || '',
      mask: plaidAccount.mask || '',
    });
  });

  const plaidConnectionItems = Array.from(itemsMap.values());
  console.log('Plaid connection items:', plaidConnectionItems);

  return plaidConnectionItems;
}

// fetch/persist transactions and analyze spending
async function budgetAnalysis(plaidConnectionItems: AccountOnboardingPlaidConnectionItem[], supabase: SupabaseClient) {
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

  const categorySpending = new Map<string, number>();

  for (const item of plaidConnectionItems) {
    const accessToken = item.accessToken;

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

        // Persist transactions to fin_account_transactions table
        let errorMessage = await persistTransactions(transactions, item.svendItemId);
        if (errorMessage) {
          return {
            categorySpending: null,
            errorMessage: errorMessage
          };
        }

        // Analyze transactions
        for (const transaction of transactions) {
          if (transaction.personal_finance_category?.detailed) {
            const identifyingCategory = transaction.personal_finance_category.detailed;
            const amount = transaction.amount;
            categorySpending.set(identifyingCategory, (categorySpending.get(identifyingCategory) || 0) + amount);
          }
        }

        hasMore = response.data.has_more;
        nextCursor = response.data.next_cursor;
      } catch (error: any) {
        return {
          categorySpending: null,
          errorMessage: `Failed to sync transactions: ${error.message}`
        };
      }
    }

    // Update the next_cursor for the Plaid item in the database
    const { error: updateError } = await supabase
      .from('plaid_connection_items')
      .update({ next_cursor: nextCursor })
      .eq('id', item.svendItemId);

    if (updateError) {
      console.error('Error updating next_cursor:', updateError);
      return {
        categorySpending: null,
        errorMessage: `Failed to update next_cursor for item ${item.svendItemId}: ${updateError.message}`
      };
    }
  }

  return {
    categorySpending: Object.fromEntries(categorySpending),
    errorMessage: null
  };
}

async function persistTransactions(transactions: Transaction[], svendItemId: string) {
  const supabaseAdminClient = getSupabaseServerAdminClient();

  const { data: plaidAccountIds } = await supabaseAdminClient
    .from('plaid_accounts')
    .select('id, plaid_account_id')
    .eq('plaid_conn_item_id', svendItemId);

  const plaidAccountIdMap = new Map(plaidAccountIds?.map(account => [account.plaid_account_id, account.id]));

  const transactionsToInsert = transactions.map(transaction => ({
    plaid_account_id: plaidAccountIdMap.get(transaction.account_id) as string,
    amount: transaction.amount,
    iso_currency_code: transaction.iso_currency_code,
    category_primary: transaction.personal_finance_category?.primary,
    category_detailed: transaction.personal_finance_category?.detailed,
    category_confidence: transaction.personal_finance_category?.confidence_level,
    date: transaction.date,
    merchant_name: transaction.merchant_name,
    payee: transaction.payment_meta.payee,
    raw_data: JSON.stringify(transaction)
  }));

  const { error } = await supabaseAdminClient
    .from('fin_account_transactions')
    .insert(transactionsToInsert);

  if (error) {
    return `Failed to persist transactions: ${error.message}`;
  }

  // success
  return null;
}

export async function PUT(request: Request) {
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
    console.error('Error fetching onboarding state:', fetchOnboardingError);
    return NextResponse.json({ error: 'Failed to fetch onboarding state' }, { status: 500 });
  }

  const startingContextKey = (dbAccountOnboardingState.account as any)?.contextKey;
  if (startingContextKey !== 'budget_setup') {
    return NextResponse.json({ error: 'Invalid state: ' + startingContextKey }, { status: 400 });
  }

  const budgetId = (dbAccountOnboardingState.account as any)?.budgetId;
  
  // Query supabase for accounts.slug and budgets.account_id
  const { data: accountData, error: accountError } = await supabaseAdminClient
    .from('budgets')
    .select('id, account_id, accounts(slug)')
    .eq('id', budgetId)
    .single();
  
  if (accountError) {
    console.error('Error fetching account slug:', accountError);
    return NextResponse.json({ error: 'Failed to fetch account slug' }, { status: 500 });
  }
  
  if (!accountData?.accounts?.slug) {
    console.error('Budget slug not found');
    return NextResponse.json({ error: 'Budget slug not found' }, { status: 500 });
  }

  const budgetSlug = accountData.accounts.slug;

  const onboardingService = createAccountOnboardingService();

  // update the context key to 'end' to complete onboarding
  try {
    const updateErrorMessage = await onboardingService.updateContextKey({
      supabase: supabaseAdminClient,
      userId: user.id,
      contextKey: 'end',
      validContextKeys: ['budget_setup', 'end']
    });
    if (updateErrorMessage) {
      return NextResponse.json({ error: updateErrorMessage }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to update context key:' + error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Account onboarding completed successfully',
    budgetId: budgetId,
    budgetSlug: budgetSlug
  });
}
