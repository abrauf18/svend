import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { BudgetGoal, BudgetGoalMonthlyTracking, BudgetGoalSpendingRecommendations } from '~/lib/model/budget.types';

const schema = z.object({
  budgetId: z.string().uuid('Invalid budget ID format'),
  type: z.string().min(1, 'Type is required'),
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
      (val) => {
        if (!val) return true;
        
        // Get today's date and strip time components
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0]!;
        
        // Compare the date strings directly
        return val > todayStr;  // This will compare YYYY-MM-DD strings
      },
      'Target date must be in the future.',
    ),
  description: z.string().optional(),
  debtType: z.string().optional(),
  debtPaymentComponent: z.string().optional(),
  debtInterestRate: z.number().optional()
}).refine((data) => {
  if (data.type === 'debt') {
    return data.debtType && data.debtPaymentComponent && data.debtInterestRate;
  }
  return true;
}, {
  message: "Debt type goals require debtType, debtPaymentComponent, and debtInterestRate"
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
      name: body.name,
      amount: Number(body.amount),
      fin_account_id: body.budgetFinAccountId,
      description: body.description,
      target_date: body.targetDate,
      debt_type: body.debtType,
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
      name: data.name,
      amount: data.amount,
      budgetFinAccountId: data.fin_account_id,
      description: data.description ?? undefined,
      targetDate: data.target_date,
      debtType: data.debt_type ?? undefined,
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
