import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { Budget, BudgetGoal } from '~/lib/model/budget.types';

// POST /api/onboarding/account/budget/goals
// Create a budget goal
export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();

  // Check if user is authenticated
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  const supabaseAdminClient = getSupabaseServerAdminClient();

  const { budgetId, type, name, amount, budgetFinAccountId, balance, targetDate, description, debtType, debtPaymentComponent, debtInterestRate } = body;

  // Check for required fields
  if (!budgetId) {
    return NextResponse.json({ error: 'Budget ID is a required field' }, { status: 400 });
  }
  if (!type) {
    return NextResponse.json({ error: 'Type is a required field' }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: 'Name is a required field' }, { status: 400 });
  }
  if (!amount) {
    return NextResponse.json({ error: 'Amount is a required field' }, { status: 400 });
  }
  if (!budgetFinAccountId) {
    return NextResponse.json({ error: 'Budget Financial Account ID is a required field' }, { status: 400 });
  }
  if (!balance) {
    return NextResponse.json({ error: 'Balance is a required field' }, { status: 400 });
  }
  if (!targetDate) {
    return NextResponse.json({ error: 'Target Date is a required field' }, { status: 400 });
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return NextResponse.json({ error: 'Invalid date format. Use yyyy-MM-dd format.' }, { status: 400 });
  }

  // Additional checks for 'debt' type goals
  if (type === 'debt') {
    if (!debtType) {
      return NextResponse.json({ error: 'Debt Type is a required field for debt goals' }, { status: 400 });
    }
    if (!debtPaymentComponent) {
      return NextResponse.json({ error: 'Debt Payment Component is a required field for debt goals' }, { status: 400 });
    }
    if (!debtInterestRate) {
      return NextResponse.json({ error: 'Debt Interest Rate is a required field for debt goals' }, { status: 400 });
    }
  }

  // Check if budget exists and get any matching goal in a single query
  const { data: result, error: fetchError } = await supabaseAdminClient
    .from('budgets')
    .select(`
      id,
      goals:budget_goals (
        id
      )
    `)
    .eq('id', budgetId)
    .eq('goals.type', type)
    .single();

  if (fetchError) {
    if (fetchError.code === 'PGRST116') { // PGRST116 is the code for no rows found
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Error checking budget and goals' }, { status: 500 });
  }

  const existingGoal = result?.goals?.[0];

  let data, error;

  // Upsert the goal and return the full object
  ({ data, error } = await supabaseAdminClient
    .from('budget_goals')
    .upsert({
      id: existingGoal?.id, // Will be undefined for new goals
      budget_id: budgetId,
      type,
      name,
      amount,
      fin_account_id: budgetFinAccountId,
      description,
      target_date: targetDate,
      debt_type: debtType,
      debt_payment_component: debtPaymentComponent,
      debt_interest_rate: debtInterestRate,
      tracking: {
        startingBalance: balance,
        allocations: []
      }
    })
    .select('*'));

  if (error) {
    console.error(error);
    const isForeignKeyViolation = error.message.includes('violates foreign key constraint "budget_goals_fin_account_id_fkey"');
    
    if (isForeignKeyViolation) {
      return NextResponse.json({ error: 'invalid budget financial account id' }, { status: 409 });
    }

    return NextResponse.json({ error: 'unknown error' }, { status: 500 });
  }

  // Ensure the response matches the AccountOnboardingBudgetGoal type
  const budgetGoal: BudgetGoal = {
    id: data?.[0]?.id!,
    budgetId: data?.[0]?.budget_id!,
    type: data?.[0]?.type!,
    name: data?.[0]?.name!,
    amount: data?.[0]?.amount!,
    budgetFinAccountId: data?.[0]?.fin_account_id!,
    description: data?.[0]?.description!,
    targetDate: data?.[0]?.target_date!,
    debtType: data?.[0]?.debt_type!,
    debtPaymentComponent: data?.[0]?.debt_payment_component!,
    debtInterestRate: data?.[0]?.debt_interest_rate!,
    tracking: {
      startingBalance: (data?.[0]?.tracking as any)?.starting_balance!,
      allocations: (data?.[0]?.tracking as any)?.allocations!
    },
    createdAt: data?.[0]?.created_at!
  };

  return NextResponse.json({ budgetGoal });
}
