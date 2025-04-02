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

// POST /api/onboarding/account/manual/transactions
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
        return NextResponse.json({ error: 'Invalid onboarding state' }, { status: 403 });
      }

      const budgetId = onboardingState.budgetId;

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
          merchant_name: merchant_name || '',
          payee: '',
          iso_currency_code: 'USD',
          tx_status,
          meta_data:{
            created_for: budgetId  || ' '
          },
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

// Schema for PATCH request
const syncToBudgetSchema = z.object({
  budgetId: z.string().uuid(),
  manualAccountId: z.string().uuid()
});

// PATCH /api/onboarding/account/manual/transactions
// Sync manual transactions to budget transactions
export const PATCH = enhanceRouteHandler(
  async ({ body, user }) => {
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      const { budgetId, manualAccountId } = body;
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
        return NextResponse.json({ error: 'Invalid onboarding state' }, { status: 403 });
      }

      // 1. Verify account belongs to user and is linked to budget
      const { data: account, error: accountError } = await supabaseAdmin
        .from('manual_fin_accounts')
        .select(`
          id,
          budget_fin_accounts!inner (
            id,
            budget_id
          ),
          manual_fin_institutions!inner (
            owner_account_id
          ),
          fin_account_transactions (*)
        `)
        .eq('id', manualAccountId)
        .eq('budget_fin_accounts.budget_id', budgetId)
        .single();

      if (accountError) throw accountError;
      if (!account) {
        return NextResponse.json(
          { error: 'Account not found or not linked to budget' },
          { status: 404 }
        );
      }

      if (account.manual_fin_institutions.owner_account_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      // 2. Create budget transactions using stored procedure
      if (account.fin_account_transactions?.length) {
        const { error: syncError } = await supabaseAdmin
          .rpc('create_budget_fin_account_transactions', {
            p_budget_id: budgetId,
            p_transactions: account.fin_account_transactions.map(tx => ({
              user_tx_id: tx.user_tx_id,
              plaid_tx_id: null,
              manual_account_id: tx.manual_account_id || null,
              budget_fin_account_id: account.budget_fin_accounts[0]!.id,
              amount: tx.amount,
              date: tx.date,
              svend_category_id: tx.svend_category_id,
              merchant_name: tx.merchant_name || '',
              meta_data: tx.meta_data || {},
              payee: tx.payee || '',
              tx_status: tx.tx_status,
              iso_currency_code: tx.iso_currency_code || 'USD',
              plaid_category_detailed: null,
              plaid_category_confidence: null,
              plaid_raw_data: null,
              notes: null,
              tag_ids: null,
            }))
          });

        if (syncError) throw syncError;
      }

      return NextResponse.json({ 
        message: 'Transactions synced successfully',
        count: account.fin_account_transactions?.length || 0
      });
    } catch (err: any) {
      console.error('Failed to sync transactions to budget:', err);
      return NextResponse.json(
        { error: 'Failed to sync transactions' },
        { status: 500 }
      );
    }
  },
  { schema: syncToBudgetSchema }
);
