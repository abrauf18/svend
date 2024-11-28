import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';
import { createBudgetService } from '~/lib/server/budget.service';

// PUT /api/budget/[budgetId]/onboarding/end
// Updates the onboarding step to "end"
export async function PUT(
  request: Request,
  { params }: { params: { budgetId: string } }
) {
  if (!params.budgetId) {
    return NextResponse.json({ error: 'Budget ID is required' }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  // authenticate user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseServerAdminClient();

  // authorize user for budgets.write permission
  const budgetService = createBudgetService(supabaseAdmin);
  const hasPermission = await budgetService.hasPermission({
    budgetId: params.budgetId,
    userId: user.id,
    permission: 'budgets.write'
  });
  if (!hasPermission) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get budget for this team account
  const { data: budget, error: budgetError } = await supabase
    .from('budgets')
    .select('current_onboarding_step, team_account_id')
    .eq('id', params.budgetId)
    .single();

  if (budgetError || !budget) {
    return NextResponse.json(
      { error: 'Budget not found' }, 
      { status: budgetError?.code === 'PGRST116' ? 404 : 500 }
    );
  }

  // Verify current step is 'invite_members'
  if (budget.current_onboarding_step !== 'invite_members') {
    return NextResponse.json(
      { error: 'Budget is not in invite_members step' }, 
      { status: 409 }
    );
  }

  // Update the budget's onboarding step to "end"
  const { error: updateError } = await supabaseAdmin
    .from('budgets')
    .update({ current_onboarding_step: 'end' })
    .eq('id', params.budgetId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
