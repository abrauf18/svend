import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const patchSchema = z.object({
  action: z.enum(['link_account', 'unlink_account']),
});

// PATCH /api/onboarding/account/manual/accounts/[accountId]
// Link or unlink a manual account to the onboarding budget
export const PATCH = enhanceRouteHandler(
  async ({ params, body, user }) => {
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      const { accountId } = params;
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

      // Verify account belongs to user
      const { data: account, error: accountError } = await supabase
        .from('manual_fin_accounts')
        .select(`
          id,
          manual_fin_institutions!inner (
            owner_account_id
          )
        `)
        .eq('id', accountId!)
        .single();

      if (accountError || !account) {
        throw new Error('Failed to fetch account');
      }

      if (account.manual_fin_institutions.owner_account_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      // Proceed with link/unlink
      if (body.action === 'unlink_account') {
        const { error } = await supabaseAdmin
          .from('budget_fin_accounts')
          .delete()
          .eq('manual_account_id', accountId!);

        if (error) throw error;

        return NextResponse.json(
          { data: 'ok', budgetId: onboardingState.budgetId },
          { status: 200 },
        );
      }

      if (body.action === 'link_account') {
        const { error } = await supabaseAdmin
          .from('budget_fin_accounts')
          .insert({
            budget_id: onboardingState.budgetId,
            manual_account_id: accountId,
          });

        if (error) throw error;

        return NextResponse.json(
          { data: 'ok', budgetId: onboardingState.budgetId },
          { status: 200 },
        );
      }

      return NextResponse.json({ error: 'Wrong action' }, { status: 400 });
    } catch (err: any) {
      console.error('Account link/unlink failed:', err.message);
      return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
    }
  },
  { schema: patchSchema },
);

// DELETE /api/onboarding/account/manual/accounts/[accountId]
// Delete the account in onboarding account
export const DELETE = enhanceRouteHandler(
  async ({ params, user }) => {
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      const { accountId } = params;
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

      // Verify account belongs to user
      const { data: account, error: accountError } = await supabase
        .from('manual_fin_accounts')
        .select(`
          id,
          manual_fin_institutions!inner (
            owner_account_id
          )
        `)
        .eq('id', accountId!)
        .single();

      if (accountError || !account) {
        throw new Error('Failed to fetch account');
      }

      if (account.manual_fin_institutions.owner_account_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      // Delete the account - this will cascade to:
      // - fin_account_transactions (via ON DELETE CASCADE)
      // - budget_fin_accounts (via ON DELETE CASCADE)
      const { error: deleteError } = await supabaseAdmin
        .from('manual_fin_accounts')
        .delete()
        .eq('id', accountId!);

      if (deleteError) throw deleteError;

      return NextResponse.json({ data: 'ok' }, { status: 200 });
    } catch (err: any) {
      console.error('Account deletion failed:', err.message);
      return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
    }
  },
  {},
);

// PUT /api/onboarding/account/manual/accounts/[accountId]
// Update the account in onboarding account
const putSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Name should have between 1 and 50 characters' })
    .max(50, { message: 'Name should have between 1 and 50 characters' }),
  type: z.enum(['depository', 'credit', 'loan', 'investment', 'other'], {
    errorMap: () => ({ message: 'Please select a valid account type' }),
  }),
  mask: z
    .string()
    .length(4, { message: 'Mask must be 4 characters long' })
    .refine((data) => (data.match(/[^0-9]/g) ? false : true), {
      message: 'Mask should contain only numbers',
    }),
  balanceCurrent: z.number().min(0, { message: 'Balance must be 0 or greater' }),
});

export const PUT = enhanceRouteHandler(
  async ({ body, params, user }) => {
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      const { accountId } = params;
      const { name, type, mask, balanceCurrent } = body;
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

      // Verify account belongs to user
      const { data: account, error: accountError } = await supabase
        .from('manual_fin_accounts')
        .select(`
          id,
          manual_fin_institutions!inner (
            owner_account_id
          )
        `)
        .eq('id', accountId!)
        .single();

      if (accountError || !account) {
        throw new Error('Failed to fetch account');
      }

      if (account.manual_fin_institutions.owner_account_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      // Proceed with update
      const { error } = await supabaseAdmin
        .from('manual_fin_accounts')
        .update({
          name,
          type,
          mask,
          balance_current: balanceCurrent,
        })
        .eq('id', accountId!);

      if (error) throw error;

      return NextResponse.json({ data: 'ok' }, { status: 200 });
    } catch (err: any) {
      console.error('Account update failed:', err.message);
      return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
    }
  },
  { schema: putSchema },
);
