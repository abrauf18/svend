import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function PUT(request: Request) {
  const supabase = getSupabaseServerClient();

  // Check if the user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  const supabaseAdmin = getSupabaseServerAdminClient();

  const { primary_financial_goal, goal_timeline, monthly_contribution } = body;

  if (
    primary_financial_goal.length === 0 ||
    !goal_timeline ||
    !monthly_contribution
  ) {
    return NextResponse.json(
      { error: 'Missing or invalid required fields' },
      { status: 400 },
    );
  }

  // Update the financial goals in the database
  const { data, error } = await supabaseAdmin
    .from('acct_fin_profile')
    .update({
      primary_financial_goal,
      goal_timeline,
      monthly_contribution,
    })
    .eq('account_id', user.id)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
