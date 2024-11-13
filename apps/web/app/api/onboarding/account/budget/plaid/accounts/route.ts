import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

// PATCH /api/onboarding/account/budget/plaid/accounts
// Link or unlink a Plaid account to the onboarding budget
export async function PATCH(request: Request) {
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

    // Fetch the current onboardingstate
    const { data: dbAccountOnboardingData, error: fetchOnboardingError } = await supabaseAdminClient
        .from('onboarding')
        .select('state->account')
        .eq('account_id', user.id)
        .single();

    if (fetchOnboardingError) {
        console.error('Error fetching onboarding state:', fetchOnboardingError);
        return NextResponse.json({ error: 'Failed to fetch onboarding state' }, { status: 500 });
    }

    let dbAccountOnboardingState = dbAccountOnboardingData.account as any;

    console.log('dbAccountOnboardingState.contextKey', dbAccountOnboardingState.contextKey);
    if (dbAccountOnboardingState.contextKey != 'start' && dbAccountOnboardingState.contextKey != 'plaid') {
        return NextResponse.json({ error: 'Onboarding not in correct state' }, { status: 409 });
    }

    let error;
    let budgetFinAccountId;

    if (action === 'unlink_account') {
        const { data, error: unlinkError } = await supabaseAdminClient
            .from('budget_fin_accounts')
            .delete()
            .match({
                budget_id: dbAccountOnboardingState.budgetId,
                plaid_account_id: svendPlaidAccountId
            })
            .select('id')
            .single();
        error = unlinkError;
        budgetFinAccountId = data?.id;
    } else if (action === 'link_account') {
        const { data, error: linkError } = await supabaseAdminClient
            .from('budget_fin_accounts')
            .insert({
                budget_id: dbAccountOnboardingState.budgetId,
                plaid_account_id: svendPlaidAccountId
            })
            .select('id')
            .single();
        error = linkError;
        budgetFinAccountId = data?.id;
    }

    if (error) {
        console.error(`Error performing ${action} on Plaid account: ${error.message}`);
        return NextResponse.json({ error: 'Failed to process Plaid account' }, { status: 500 });
    }

    return NextResponse.json({ 
        message: `Performed ${action} on Plaid account successfully`,
        budgetFinAccountId
    });
}
