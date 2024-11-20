import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';

// PUT /api/budget/[budgetId]/onboarding/end
// Updates the onboarding step to "end"
export async function PUT(
  request: Request,
  { params }: { params: { budgetId: string } }
) {
  const supabase = getSupabaseServerClient();
  
  // Get current user and ensure they're logged in
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
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

  // Check if user has budgets.write permission
  const { data: hasPermission, error: permissionError } = await supabase
    .rpc('has_team_permission', {
      user_id: user.id,
      team_account_id: budget.team_account_id,
      permission_name: 'budgets.write'
    });

  if (permissionError || !hasPermission) {
    return NextResponse.json(
      { error: 'Insufficient permissions' }, 
      { status: 403 }
    );
  }

  const supabaseAdmin = getSupabaseServerAdminClient();

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
