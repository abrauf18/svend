import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { enhanceRouteHandler } from '@kit/next/routes';

// PATCH /api/onboarding/account/budget/plaid/accounts
// Link or unlink a Plaid account to the onboarding budget
export const PATCH = enhanceRouteHandler(async ({ request, params }) => {
    const supabaseClient = getSupabaseServerClient();
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { svendPlaidAccountId, action } = await request.json();

    if (action !== 'link_account' && action !== 'unlink_account') {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // use admin client for remaining operations
    const supabaseAdminClient = getSupabaseServerAdminClient();

    // Fetch the current onboarding state
    const { data: dbBudgetData, error: fetchOnboardingError } = await supabaseAdminClient
        .from('budgets')
        .select('id, current_onboarding_step, accounts!inner(slug)')
        .eq('accounts.slug', params.budgetSlug!)
        .single();

    if (fetchOnboardingError || !dbBudgetData) {
        console.error('Error fetching budget:', fetchOnboardingError);
        return NextResponse.json({ error: 'Failed to fetch budget' }, { status: 500 });
    }

    console.log('current_onboarding_step:', dbBudgetData.current_onboarding_step);
    if (!['start', 'plaid', 'manual'].includes(dbBudgetData.current_onboarding_step)) {
        return NextResponse.json({ error: 'Onboarding not in correct state' }, { status: 409 });
    }

    let error;
    let budgetFinAccountId;

    if (action === 'unlink_account') {
        const { data, error: unlinkError } = await supabaseAdminClient
            .from('budget_fin_accounts')
            .delete()
            .match({
                budget_id: dbBudgetData.id,
                plaid_account_id: svendPlaidAccountId
            })
            .select('id')
            .single();
        error = unlinkError;
        budgetFinAccountId = data?.id;
    } else if (action === 'link_account') {
        const { data, error: linkError } = await supabaseAdminClient.rpc(
            'link_budget_plaid_account',
            { 
                p_budget_id: dbBudgetData.id, 
                p_plaid_account_id: svendPlaidAccountId 
            }
        );
        error = linkError;
        budgetFinAccountId = data;
    }

    if (error) {
        console.error(`Error performing ${action} on Plaid account: ${error.message}`);
        return NextResponse.json({ error: 'Failed to process Plaid account' }, { status: 500 });
    }

    return NextResponse.json({ 
        message: `Performed ${action} on Plaid account successfully`,
        budgetFinAccountId
    });
});
