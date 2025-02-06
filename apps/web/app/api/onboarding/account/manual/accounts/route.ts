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
  async ({ body, user }) => {
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      const { name, institutionId, type, mask, balanceCurrent } = body;
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
        .eq('id', institutionId)
        .single();

      if (institutionError || !institution) {
        throw new Error('Failed to fetch institution');
      }

      if (institution.owner_account_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      // Create the account
      const { data: insertedAccounts, error: accountsError } = await supabaseAdmin
        .from('manual_fin_accounts')
        .insert({
          owner_account_id: user.id,
          institution_id: institutionId,
          type,
          name,
          mask,
          balance_current: balanceCurrent,
        })
        .select('id');

      if (accountsError) throw accountsError;
      if (!insertedAccounts?.length) throw new Error('No accounts were returned');

      // Link account to budget
      const { error: budgetAccountsError } = await supabaseAdmin
        .from('budget_fin_accounts')
        .insert({
          budget_id: onboardingState.budgetId,
          manual_account_id: insertedAccounts[0]?.id,
        });

      if (budgetAccountsError) throw budgetAccountsError;

      return NextResponse.json(
        {
          message: 'Account created successfully',
          accountId: insertedAccounts[0]?.id,
          budgetId: onboardingState.budgetId,
        },
        { status: 200 },
      );
    } catch (err: any) {
      console.error('Account creation failed:', err.message);
      return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
    }
  },
  { schema: accountSchema },
);
