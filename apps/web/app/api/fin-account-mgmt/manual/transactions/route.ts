import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createTransactionService } from '~/lib/server/transaction.service';

const transactionSchema = z.object({
  date: z.string().min(1, { message: 'Date is required' }),
  amount: z.number({
    required_error: 'Amount is a required field',
    invalid_type_error: 'Must be a valid number',
  }),
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
  merchant_name: z.string().optional(),
  tx_status: z.enum(['pending', 'posted', 'PENDING', 'POSTED'])
    .transform(val => val.toLowerCase() as 'pending' | 'posted')
    .default('posted'),
});

// POST /api/fin-account-mgmt/manual/transactions
// Create a new transaction
export const POST = enhanceRouteHandler(
  async ({ body, user }) => {
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      const {
        date,
        amount,
        manual_account_id,
        svend_category_id,
        user_tx_id,
        merchant_name,
        tx_status = 'posted', // Add default value
      } = body;
      
      const supabase = getSupabaseServerClient();
      const supabaseAdmin = getSupabaseServerAdminClient();

      // Verify account belongs to user
      const { data: account, error: accountError } = await supabase
        .from('manual_fin_accounts')
        .select(`
          id,
          manual_fin_institutions!inner (
            owner_account_id
          )
        `)
        .eq('id', manual_account_id)
        .single();

      if (accountError || !account) {
        throw new Error('Failed to fetch account');
      }

      if (account.manual_fin_institutions.owner_account_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      // Create the fin_account_transaction
      const { data: dbTx, error: finTxError } = await supabaseAdmin
        .from('fin_account_transactions')
        .insert({
          user_tx_id,
          date,
          amount,
          manual_account_id,
          merchant_name: merchant_name ?? '',
          payee: '',
          iso_currency_code: 'USD',
          tx_status,
          svend_category_id,
        })
        .select('*')
        .single();

      if (finTxError) throw finTxError;
      if (!dbTx) throw new Error('No transaction was created');

      const transactionService = createTransactionService(supabaseAdmin);
      const [transaction] = transactionService.parseTransactions([dbTx]);

      return NextResponse.json({
        message: 'Transaction created successfully',
        transaction,
      });
    } catch (err: any) {
      console.error('Transaction creation failed:', err.message);
      return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
    }
  },
  { schema: transactionSchema },
);
