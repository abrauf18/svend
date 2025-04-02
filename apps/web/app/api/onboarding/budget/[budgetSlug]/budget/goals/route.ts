import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { BudgetGoal, BudgetGoalMonthlyTracking, BudgetGoalSpendingRecommendations } from '~/lib/model/budget.types';

const savingsSubTypes = [
  'emergency_fund',
  'house',
  'retirement',
  'education',
  'vacation',
  'general'
] as const;

const debtSubTypes = [
  'loans',
  'credit_cards'
] as const;

const schema = z.object({
  budgetId: z.string().uuid('Invalid budget ID format'),
  type: z.enum(['debt', 'savings', 'investment', 'charity'], {
    required_error: 'Type is required',
    invalid_type_error: 'Invalid goal type'
  }),
  subType: z.union([
    z.enum(savingsSubTypes),
    z.enum(debtSubTypes)
  ]).optional(),
  name: z.string().min(1, 'Name is required'),
  amount: z.number({
    required_error: 'Amount is required',
    invalid_type_error: 'Amount must be a number'
  }),
  budgetFinAccountId: z.string().uuid('Invalid account ID format'),
  balance: z.number({
    required_error: 'Balance is required',
    invalid_type_error: 'Balance must be a number'
  }),
  targetDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use yyyy-MM-dd format.')
    .refine(
      (val) => !val || val > new Date().toISOString().split('T')[0]!,
      'Target date must be in the future.',
    ),
  description: z.string().optional(),
  debtPaymentComponent: z.enum(['principal', 'interest', 'principal_interest']).optional(),
  debtInterestRate: z.number().optional()
}).refine((data) => {
  if (data.type === 'debt') {
    return Boolean(
      data.subType && 
      debtSubTypes.includes(data.subType as typeof debtSubTypes[number]) &&
      data.debtPaymentComponent && 
      data.debtInterestRate
    );
  }
  if (data.type === 'savings') {
    return Boolean(
      data.subType && 
      savingsSubTypes.includes(data.subType as typeof savingsSubTypes[number])
    );
  }
  return true;
}, {
  message: "Missing required fields or invalid subtype for goal type"
});

// POST /api/onboarding/account/budget/goals
// Create a budget goal
export const POST = enhanceRouteHandler(
  async ({ body }) => {
    const supabase = getSupabaseServerClient();
    const supabaseAdmin = getSupabaseServerAdminClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if budget exists and get any matching goal
    const { data: result, error: fetchError } = await supabaseAdmin
      .from('budgets')
      .select(`
        id,
        goals:budget_goals (
          id
        )
      `)
      .eq('id', body.budgetId)
      .eq('goals.type', body.type)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Error checking budget and goals' }, { status: 500 });
    }

    const existingGoal = result?.goals?.[0];
    const currentMonth = new Date().toISOString().substring(0, 7);

    // Prepare the data for upsert
    const goalData = {
      id: existingGoal?.id,
      budget_id: body.budgetId,
      type: body.type,
      subtype: (body.type === 'debt' || body.type === 'savings') ? body.subType : null,
      name: body.name,
      amount: Number(body.amount),
      fin_account_id: body.budgetFinAccountId,
      description: body.description,
      target_date: body.targetDate,
      debt_payment_component: body.debtPaymentComponent,
      debt_interest_rate: body.debtInterestRate,
      spending_tracking: {
        [currentMonth]: {
          month: currentMonth,
          startingBalance: body.balance,
          endingBalance: body.balance,
          allocations: {}
        }
      },
      spending_recommendations: {}
    };

    // Upsert the goal
    const { data, error: upsertError } = await supabaseAdmin
      .from('budget_goals')
      .upsert(goalData as any)
      .select('*')
      .single();

    if (upsertError) {
      console.error('Error creating budget goal:', upsertError);
      if (upsertError.message.includes('violates foreign key constraint "budget_goals_fin_account_id_fkey"')) {
        return NextResponse.json({ error: 'Invalid budget financial account ID' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Error creating budget goal' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Failed to create budget goal' }, { status: 500 });
    }

    const budgetGoal: BudgetGoal = {
      id: data.id,
      budgetId: data.budget_id,
      type: data.type,
      subType: data.subtype ?? '',
      name: data.name,
      amount: data.amount,
      balance: body.balance,
      budgetFinAccountId: data.fin_account_id,
      description: data.description ?? undefined,
      targetDate: data.target_date,
      debtPaymentComponent: data.debt_payment_component ?? undefined,
      debtInterestRate: data.debt_interest_rate ?? undefined,
      spendingTracking: {
        [currentMonth]: {
          month: currentMonth,
          startingBalance: body.balance,
          endingBalance: body.balance,
          allocations: {}
        }
      } as Record<string, BudgetGoalMonthlyTracking>,
      spendingRecommendations: {} as BudgetGoalSpendingRecommendations,
      createdAt: data.created_at
    };

    return NextResponse.json({ budgetGoal });
  },
  { schema }
);
