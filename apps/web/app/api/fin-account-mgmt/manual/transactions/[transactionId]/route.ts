import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  date: z.string().min(1, { message: 'Date is required' }),
  amount: z.number({
    required_error: 'Amount is a required field',
    invalid_type_error: 'Must be a valid number',
  }),
  svend_category_id: z.string().min(1, { message: 'Category is required' }),
  manual_account_id: z.string().min(1, { message: 'Account is required' }),
  user_tx_id: z.string().min(1, { message: 'user_tx_id is required' }),
  merchant_name: z.string().optional(),
  tx_status: z.enum(['pending', 'posted', 'PENDING', 'POSTED'])
    .transform(val => val.toLowerCase() as 'pending' | 'posted')
    .default('posted'),
});

// PUT /api/fin-account-mgmt/manual/transactions/[transactionId]
// Update the transaction in manual account
export const PUT = enhanceRouteHandler(
  async ({ body, params, user }) => {
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    try {
      const { transactionId } = params;
      const supabase = getSupabaseServerClient();

      // Verify transaction belongs to user's manual account
      const { data: transaction, error: transactionError } = await supabase
        .from('fin_account_transactions')
        .select(`
          *,
          manual_fin_accounts!inner (
            manual_fin_institutions!inner (
              owner_account_id
            )
          )
        `)
        .eq('id', transactionId!)
        .single();

      if (transactionError) {
        throw new Error(`Failed to fetch transaction: ${transactionError.message}`);
      }

      if (!transaction || transaction.manual_fin_accounts.manual_fin_institutions.owner_account_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      const supabaseAdmin = getSupabaseServerAdminClient();

      // Proceed with update
      const { error } = await supabaseAdmin
        .from('fin_account_transactions')
        .update({
          date: body.date,
          amount: body.amount,
          svend_category_id: body.svend_category_id,
          manual_account_id: body.manual_account_id,
          user_tx_id: body.user_tx_id,
          merchant_name: body.merchant_name ?? '',
          payee: '',
          iso_currency_code: 'USD',
          tx_status: body.tx_status,
        })
        .eq('id', transactionId!);

      if (error) {
        throw new Error(`Failed to update transaction: ${error.message}`);
      }

      return NextResponse.json({
        message: 'Transaction updated successfully',
        data: { 
          ...body,
          user_tx_id: transaction.user_tx_id,
          tx_status: body.tx_status?.toLowerCase() ?? transaction.tx_status,
          merchant_name: body.merchant_name ?? transaction.merchant_name ?? '',
        },
        transactionId,
      });
    } catch (err: any) {
      console.error('Transaction update failed:', err.message);
      return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
    }
  },
  { schema },
);

// DELETE /api/fin-account-mgmt/manual/transactions/[transactionId]
// Delete the transaction in manual account
export const DELETE = enhanceRouteHandler(
  async ({ params, user }) => {
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    try {
      const { transactionId } = params as { transactionId: string };
      const supabase = getSupabaseServerClient();
      const supabaseAdmin = getSupabaseServerAdminClient();

      // Verify transaction belongs to user's manual account
      const { data: transaction, error: transactionError } = await supabase
        .from('fin_account_transactions')
        .select(`
          *,
          manual_fin_accounts!inner (
            manual_fin_institutions!inner (
              owner_account_id
            )
          )
        `)
        .eq('id', transactionId)
        .single();

      if (transactionError?.code === 'PGRST116') {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }

      if (transactionError) {
        throw new Error(`Failed to fetch transaction: ${transactionError.message}`);
      }

      if (!transaction || transaction.manual_fin_accounts.manual_fin_institutions.owner_account_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      // Use supabaseAdmin for deletion
      const { data, error } = await supabaseAdmin
        .from('fin_account_transactions')
        .delete()
        .eq('id', transactionId)
        .select();

      if (error) {
        throw new Error(`Failed to delete transaction: ${error.message}`);
      }

      return NextResponse.json({ data }, { status: 200 });
    } catch (err: any) {
      console.error('Transaction deletion failed:', err.message);
      return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
    }
  },
  {},
);
