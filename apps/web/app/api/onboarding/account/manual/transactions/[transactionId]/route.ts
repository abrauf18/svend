import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// PUT /api/onboarding/account/manual/transactions/[transactionId]
// Update the transaction in onboarding account

const putBodySchema = z.object({
  date: z.string().min(1, { message: 'Date is required' }),
  amount: z.number().min(1, { message: 'Amount is required' }),
  svend_category_id: z.string().min(1, { message: 'Category is required' }),
  manual_account_id: z.string().min(1, { message: 'Account is required' }),
  user_tx_id: z.string().min(1, { message: 'user_tx_id is required' }),
  merchant_name: z.string().optional(),
});

export const PUT = enhanceRouteHandler(
  async ({ body, params }) => {
    try {
      const { transactionId } = params as {
        transactionId: string;
      };
      const {
        date,
        amount,
        svend_category_id,
        manual_account_id,
        user_tx_id,
        merchant_name,
      } = body;

      const supabaseAdminClient = getSupabaseServerAdminClient();

      const { error } = await supabaseAdminClient.rpc(
        'update_onboarding_transaction',
        {
          p_transaction_input: {
            amount,
            date,
            svend_category_id,
            manual_account_id,
            id: transactionId,
            user_tx_id,
            merchant_name: merchant_name ?? null,
          },
        },
      );

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json(
        {
          message: 'Transaction updated successfully',
          data: {
            date,
            amount,
            svend_category_id,
            manual_account_id,
            user_tx_id,
            merchant_name,
          },
          transactionId: transactionId,
        },
        { status: 200 },
      );
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  },
  { auth: false, schema: putBodySchema },
);

// DELETE /api/onboarding/account/manual/transactions/[transactionId]
// Delete the transaction in onboarding account

export const DELETE = enhanceRouteHandler(
  async ({ params }) => {
    try {
      const { transactionId } = params;

      if (!transactionId) throw new Error('Invalid request body');

      const supabaseAdminClient = getSupabaseServerAdminClient();

      const { data, error } = await supabaseAdminClient.rpc(
        'delete_transactions',
        {
          p_transaction_ids: [transactionId],
        },
      );

      if (error) throw error;

      return NextResponse.json({ data }, { status: 200 });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  },
  { auth: false },
);
