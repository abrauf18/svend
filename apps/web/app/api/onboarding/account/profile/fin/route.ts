import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';

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
        incomeLevel,
        savingsLevel,
        debtTypes
    } = body;

    if (!incomeLevel || !savingsLevel || !debtTypes) {
        return NextResponse.json({ error: 'missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
        .from('acct_fin_profile')
        .update({
            income_level: incomeLevel,
            savings: savingsLevel,
            current_debt: debtTypes,
        })
        .eq('account_id', user.id)
        .select();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
}
