import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { createAccountOnboardingService } from '~/lib/server/onboarding.service';
import { BudgetCategoryGroupSpending } from '~/lib/model/budget.types';

// PUT /api/onboarding/account/budget/spending
// Update budget category group spending (end account onboarding)
export async function PUT(request: Request) {
  // Authentication
  const supabaseClient = getSupabaseServerClient();
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Request body validation
  let body: { categorySpending: Record<string, BudgetCategoryGroupSpending> };
  try {
    body = await request.json();
    if (!body.categorySpending || typeof body.categorySpending !== 'object') {
      return NextResponse.json({ error: 'Missing or invalid categorySpending field' }, { status: 400 });
    }

    // Validate each spending entry
    for (const [key, spending] of Object.entries(body.categorySpending)) {
      // Validate required fields
      if (
        typeof spending.groupName !== 'string' ||
        typeof spending.spending !== 'number' ||
        typeof spending.recommendation !== 'number' ||
        typeof spending.target !== 'number' ||
        typeof spending.isTaxDeductible !== 'boolean' ||
        typeof spending.targetSource !== 'string' ||
        !['group', 'category'].includes(spending.targetSource) ||
        !Array.isArray(spending.categories)
      ) {
        return NextResponse.json({ 
          error: `Invalid spending data for category ${key}. Missing or invalid required fields.` 
        }, { status: 400 });
      }

      // Validate each category in the categories array
      for (const category of spending.categories) {
        if (
          typeof category.categoryName !== 'string' ||
          typeof category.spending !== 'number' ||
          typeof category.recommendation !== 'number' ||
          typeof category.target !== 'number' ||
          typeof category.isTaxDeductible !== 'boolean'
        ) {
          return NextResponse.json({ 
            error: `Invalid category data in group ${key}` 
          }, { status: 400 });
        }
      }
    }
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // ----------------------------------------
  // Onboarding state validation
  // ----------------------------------------
  const supabaseAdminClient = getSupabaseServerAdminClient();

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

  // ----------------------------------------
  // Update budget category spending
  // ----------------------------------------
  const { error: updateError } = await supabaseAdminClient
    .from('budgets')
    .update({ 
      category_spending: body.categorySpending
    })
    .eq('id', budgetId);

  if (updateError) {
    console.error('Error updating budget category spending:', updateError);
    return NextResponse.json({ error: 'Failed to update budget category spending' }, { status: 500 });
  }

  // ----------------------------------------
  // Budget data retrieval
  // ----------------------------------------
  const { data: accountData, error: accountError } = await supabaseAdminClient
    .from('budgets')
    .select('id, team_account_id, accounts(slug)')
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

  // ----------------------------------------
  // Complete onboarding
  // ----------------------------------------
  const onboardingService = createAccountOnboardingService();

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
