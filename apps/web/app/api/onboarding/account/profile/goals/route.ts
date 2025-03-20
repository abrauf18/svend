import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';

// PUT /api/onboarding/account/profile/goals
// Update onboarding account profile goals
export async function PUT(request: Request) {
    const supabase = getSupabaseServerClient();

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const supabaseAdmin = getSupabaseServerAdminClient();

    const {
        primaryFinancialGoals,
        goalTimeline,
        monthlyContribution
    } = body;

    // Ensure primaryFinancialGoal is an array
    if (!primaryFinancialGoals) {
        console.error('Error: primaryFinancialGoals is missing');
        return NextResponse.json({ error: 'primaryFinancialGoals is required' }, { status: 400 });
    }
    if (!Array.isArray(primaryFinancialGoals)) {
        console.error('Error: primaryFinancialGoal is not an array or missing');
        return NextResponse.json({ error: 'primaryFinancialGoals must be an array' }, { status: 400 });
    }
    if (!goalTimeline) {
        console.error('Error: goalTimeline is missing');
        return NextResponse.json({ error: 'goalTimeline is required' }, { status: 400 });
    }
    if (!monthlyContribution) {
        console.error('Error: monthlyContribution is missing');
        return NextResponse.json({ error: 'monthlyContribution is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
        .from('acct_fin_profile')
        .update({
            annual_income: monthlyContribution * 12
        })
        .eq('account_id', user.id)
        .select();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
}
