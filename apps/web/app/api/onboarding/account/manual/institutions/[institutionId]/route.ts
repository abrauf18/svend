import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const putSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Name should have between 1 and 50 characters' })
    .max(50, { message: 'Name should have between 1 and 50 characters' }),
  symbol: z
    .string({
      invalid_type_error: 'Invalid symbol',
      required_error: 'Symbol is a required field',
    })
    .min(3, { message: 'Symbol must be at least 3 characters long' })
    .max(5, { message: 'Symbol must be 3 to 5 characters long' })
    .refine(
      (data) => {
        if (data.match(/[0-9]/g)) return false;
        return true;
      },
      { message: 'Numbers are not allowed' },
    )
    .transform((data) => data.trim().toUpperCase().replace(/[0-9]/g, '')),
});

// PUT /api/onboarding/account/manual/institutions/[institutionId]
// Update a manual account
export const PUT = enhanceRouteHandler(
  async ({ params, body, user }) => {
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      const { institutionId } = params;
      const { name, symbol } = body;
      const supabase = getSupabaseServerClient();
      const supabaseAdmin = getSupabaseServerAdminClient();

      // Check if user is in onboarding
      const { data: onboardingData, error: onboardingError } = await supabase
        .from('user_onboarding')
        .select('state->account')
        .eq('user_id', user.id)
        .single();

      if (onboardingError) {
        throw new Error(`Failed to fetch onboarding state: ${onboardingError.message}`);
      }

      const onboardingState = onboardingData?.account as any;
      if (!['start', 'plaid', 'manual'].includes(onboardingState.contextKey)) {
        return NextResponse.json({ error: 'User not in onboarding' }, { status: 403 });
      }

      // Verify institution belongs to user
      const { data: institution, error: institutionError } = await supabase
        .from('manual_fin_institutions')
        .select('owner_account_id')
        .eq('id', institutionId!)
        .single();

      if (institutionError || !institution) {
        throw new Error('Failed to fetch institution');
      }

      if (institution.owner_account_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      // Update the institution
      const { error: updateError } = await supabaseAdmin
        .from('manual_fin_institutions')
        .update({
          name,
          symbol,
        })
        .eq('id', institutionId!);

      if (updateError) throw updateError;

      return NextResponse.json({ data: 'ok' }, { status: 200 });
    } catch (err: any) {
      console.error('Institution update failed:', err.message);
      return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
    }
  },
  { schema: putSchema },
);

// DELETE /api/onboarding/account/manual/institutions/[institutionId]
// Delete a manual account
export const DELETE = enhanceRouteHandler(
  async ({ params, user }) => {
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      const { institutionId } = params;
      const supabase = getSupabaseServerClient();
      const supabaseAdmin = getSupabaseServerAdminClient();

      // Check if user is in onboarding
      const { data: onboardingData, error: onboardingError } = await supabase
        .from('user_onboarding')
        .select('state->account')
        .eq('user_id', user.id)
        .single();

      if (onboardingError) {
        throw new Error(`Failed to fetch onboarding state: ${onboardingError.message}`);
      }

      const onboardingState = onboardingData?.account as any;
      if (!['start', 'plaid', 'manual'].includes(onboardingState.contextKey)) {
        return NextResponse.json({ error: 'User not in onboarding' }, { status: 403 });
      }

      // Verify institution belongs to user
      const { data: institution, error: institutionError } = await supabase
        .from('manual_fin_institutions')
        .select('owner_account_id')
        .eq('id', institutionId!)
        .single();

      if (institutionError || !institution) {
        throw new Error('Failed to fetch institution');
      }

      if (institution.owner_account_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      // Delete the institution - this will cascade to accounts and transactions
      const { error: deleteError } = await supabaseAdmin
        .from('manual_fin_institutions')
        .delete()
        .eq('id', institutionId!);

      if (deleteError) throw deleteError;

      return NextResponse.json({ data: 'ok' }, { status: 200 });
    } catch (err: any) {
      console.error('Institution deletion failed:', err.message);
      return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
    }
  },
  {},
);