import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// POST /api/onboarding/account/manual/institutions
// Create a new institution

const transactionSchema = z.object({
  date: z.string().min(1, { message: 'Date is required' }),
  amount: z.number().min(1, { message: 'Amount is required' }),
  manual_account_id: z.string().min(1, { message: 'Account is required' }),
  svend_category_id: z.string().min(1, { message: 'Category is required' }),
  user_tx_id: z
    .string({
      invalid_type_error:
        'Transaction Id should have between 6 and 20 characters',
      required_error: 'Transaction Id is a required field',
    })
    .min(6, { message: 'Transaction Id should have at least 6 characters' })
    .max(20, { message: 'Transaction Id should have at most 20 characters' })
    .refine((data) => (data.match(/[a-z]/g) ? false : true), {
      message: 'Only capital letters are allowed',
    }),
});

export const POST = enhanceRouteHandler(
  async ({ body }) => {
    try {
      const {
        date,
        amount,
        manual_account_id,
        svend_category_id,
        user_tx_id,
      } = body;

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

      const { data: budgetFinAccount, error: budgetFinAccountError } =
        await supabaseAdmin
          .from('budget_fin_accounts')
          .select('id')
          .eq('manual_account_id', manual_account_id)
          .single();

      if (budgetFinAccountError) throw budgetFinAccountError;
      if (!budgetFinAccount)
        throw new Error('No budget fin account was returned');

      const budgetFinAccountId = budgetFinAccount.id;

      const { data, error } = await supabaseAdmin.rpc(
        'create_budget_fin_account_transactions',
        {
          p_budget_id: budgetId,
          p_transactions: [
            {
              date,
              amount,
              svend_category_id,
              budget_fin_account_id: budgetFinAccountId,
              iso_currency_code: null,
              merchant_name: null,
              payee: null,
              plaid_category_detailed: null,
              plaid_category_confidence: null,
              raw_data: null,
              user_tx_id,
              plaid_tx_id: null,
            },
          ],
        },
      );

      if (error) throw new Error(error.message);
      if (!data) throw new Error('No data was returned from the database');

      return NextResponse.json(
        {
          message:
            '[Create Transaction Endpoint] Transaction created successfully',
          transactionId: data[0],
        },
        { status: 200 },
      );
    } catch (err: any) {
      console.error(
        `[Create Transaction Endpoint] Error while creating transaction: ${err.message}`,
      );

      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  },
  { auth: false, schema: transactionSchema },
);
