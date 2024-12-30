import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const accountSchema = z.object({
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
  institutionId: z.string().min(1, { message: 'Institution is required' }),
  balanceCurrent: z.number().min(0, { message: 'Balance must be 0 or greater' }),
});

// POST /api/onboarding/account/manual/accounts
// Create a new account
export const POST = enhanceRouteHandler(
  async ({ body }) => {
    try {
      const { name, institutionId, type, mask, balanceCurrent } = body;

      const supabaseClient = getSupabaseServerClient();
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();

      if (!user) throw new Error('User not found');

      const supabaseAdmin = getSupabaseServerAdminClient();

      const { data: dbAccountOnboardingData, error: fetchOnboardingError } =
        await supabaseAdmin
          .from('user_onboarding')
          .select('state->account')
          .eq('user_id', user.id)
          .single();

      if (fetchOnboardingError) throw fetchOnboardingError;
      if (!dbAccountOnboardingData)
        throw new Error('No onboarding data was returned');

      const budgetId = (dbAccountOnboardingData.account as any).budgetId;

      const { data: insertedAccounts, error: accountsError } =
        await supabaseAdmin
          .from('manual_fin_accounts')
          .insert({
            institution_id: institutionId,
            type: type as "investment" | "depository" | "credit" | "loan" | "other",
            name,
            owner_account_id: user.id,
            mask,
            balance_current: balanceCurrent,
          })
          .select('id');

      if (accountsError) throw accountsError;
      if (!insertedAccounts) throw new Error(`No accounts were returned`);

      const { error: budgetAccountsError } = await supabaseAdmin
        .from('budget_fin_accounts')
        .insert([
          ...insertedAccounts.map((acc) => ({
            budget_id: budgetId,
            manual_account_id: acc.id,
          })),
        ]);

      if (budgetAccountsError) throw budgetAccountsError;

      return NextResponse.json(
        {
          message: '[Create Account Endpoint] Account created successfully',
          accountId: insertedAccounts[0]?.id,
          budgetId,
        },
        { status: 200 },
      );
    } catch (err: any) {
      console.error(
        `[Create Account Endpoint] Error while creating account: ${err.message}`,
      );

      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  },
  { auth: false, schema: accountSchema },
);
