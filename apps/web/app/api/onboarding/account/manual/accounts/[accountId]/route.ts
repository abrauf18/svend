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
  async ({ params, body }) => {
    try {
      const { accountId } = params;

      if (!accountId) throw new Error('Account ID is required');

      const supabaseAdmin = getSupabaseServerAdminClient();
      const supabaseClient = getSupabaseServerClient();

      const {
        data: { user },
        error: getUserError,
      } = await supabaseClient.auth.getUser();

      if (!user || getUserError)
        throw new Error(
          '[PATCH -> manual/accounts/[accountId]] User not found',
        );

      const { data: dbAccountOnboardingData, error: fetchOnboardingError } =
        await supabaseAdmin
          .from('user_onboarding')
          .select('state->account')
          .eq('user_id', user.id)
          .single();

      if (!dbAccountOnboardingData || fetchOnboardingError)
        throw new Error(
          '[PATCH -> manual/accounts/[accountId]] Failed to fetch onboarding state',
        );

      const dbAccountOnboardingState = dbAccountOnboardingData.account as any;

      if (body.action === 'unlink_account') {
        const { error } = await supabaseAdmin
          .from('budget_fin_accounts')
          .delete()
          .eq('manual_account_id', accountId);

        if (error) throw error;

        return NextResponse.json(
          { data: 'ok', budgetId: dbAccountOnboardingState.budgetId },
          { status: 200 },
        );
      }

      if (body.action === 'link_account') {
        const { error } = await supabaseAdmin
          .from('budget_fin_accounts')
          .insert({
            budget_id: dbAccountOnboardingState.budgetId,
            manual_account_id: accountId,
          });

        if (error) throw error;

        return NextResponse.json(
          { data: 'ok', budgetId: dbAccountOnboardingState.budgetId },
          { status: 200 },
        );
      }

      return NextResponse.json({ error: 'Wrong action' }, { status: 400 });
    } catch (err: any) {
      console.error(err);

      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  },
  { auth: false, schema: patchSchema },
);

// DELETE /api/onboarding/account/manual/accounts/[accountId]
// Delete the account in onboarding account
export const DELETE = enhanceRouteHandler(
  async ({ params }) => {
    try {
      const { accountId } = params;

      if (!accountId) throw new Error('Account ID is required');

      const supabaseAdmin = getSupabaseServerAdminClient();

      const { error } = await supabaseAdmin.rpc(
        'delete_manual_accounts_and_transactions',
        { p_manual_account_ids: [accountId] },
      );

      if (error) throw error;

      return NextResponse.json({ data: 'ok' }, { status: 200 });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  },
  { auth: false },
);

// PUT /api/onboarding/account/manual/accounts/[accountId]
// Update the account in onboarding account
const putSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Name should have between 1 and 50 characters' })
    .max(50, { message: 'Name should have between 1 and 50 characters' }),
  type: z.string().min(1, { message: 'Type is a required field' }),
  mask: z
    .string()
    .length(4, { message: 'Mask must be 4 characters long' })
    .refine((data) => (data.match(/[^0-9]/g) ? false : true), {
      message: 'Mask should contain only numbers',
    }),
  balanceCurrent: z.number().min(0, { message: 'Balance must be 0 or greater' }),
});

export const PUT = enhanceRouteHandler(
  async ({ body, params }) => {
    try {
      const { accountId } = params;
      const { name, type, mask, balanceCurrent } = body;

      const supabaseAdmin = getSupabaseServerAdminClient();

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
      console.error(err);

      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  },
  { auth: false, schema: putSchema },
);
