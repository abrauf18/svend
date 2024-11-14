import { Database } from '@kit/supabase/database';
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
        fullName,
        age,
        maritalStatus,
        dependents
    } = body;

    if (!fullName || !age || !maritalStatus || typeof dependents !== 'number' || dependents < 0) {
        return NextResponse.json({ error: 'missing required fields' }, { status: 400 });
    }

    // Update both profile and account name in a transaction
    const { data, error } = await supabaseAdmin
        .rpc('update_account_profile', {
            p_user_id: user.id,
            p_full_name: fullName,
            p_age: age,
            p_marital_status: maritalStatus as Database['public']['Enums']['marital_status_enum'],
            p_dependents: dependents
        });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
}
