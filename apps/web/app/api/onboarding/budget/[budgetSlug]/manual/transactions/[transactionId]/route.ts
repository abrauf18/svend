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
  tx_status: z
    .enum(['pending', 'posted', 'PENDING', 'POSTED'])
    .transform((val) => val.toLowerCase() as 'pending' | 'posted')
    .default('posted'),
});

// PUT /api/onboarding/budget/manual/transactions/[transactionId]
// Update the transaction in onboarding account
export const PUT = enhanceRouteHandler(
  async ({ body, params, user }) => {
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      const { transactionId, budgetSlug } = params;
      const supabase = getSupabaseServerClient();

      // Fetch the current budget data
      const { data: dbBudgetData, error: fetchBudgetError } = await supabase
        .from('budgets')
        .select('id, current_onboarding_step, accounts!inner(slug)')
        .eq('accounts.slug', budgetSlug!)
        .single();

      if (fetchBudgetError || !dbBudgetData) {
        console.error('Error fetching budget:', fetchBudgetError);
        return NextResponse.json(
          { error: 'Failed to fetch budget' },
          { status: 500 },
        );
      }

      if (
        !['start', 'plaid', 'manual'].includes(
          dbBudgetData.current_onboarding_step,
        )
      ) {
        return NextResponse.json(
          { error: 'Onboarding not in correct state' },
          { status: 409 },
        );
      }

      // Verify transaction belongs to user's manual account
      const { data: transaction, error: transactionError } = await supabase
        .from('fin_account_transactions')
        .select(
          `
          *,
          manual_fin_accounts!inner (
            manual_fin_institutions!inner (
              owner_account_id
            )
          )
        `,
        )
        .eq('id', transactionId!)
        .single();

      if (transactionError) {
        throw new Error(
          `Failed to fetch transaction: ${transactionError.message}`,
        );
      }

      if (
        !transaction ||
        transaction.manual_fin_accounts.manual_fin_institutions
          .owner_account_id !== user.id
      ) {
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
          merchant_name: body.merchant_name || '',
          payee: '',
          iso_currency_code: 'USD',
          tx_status: body.tx_status,
          meta_data: {
            created_for: dbBudgetData.id || ' ',
          },
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
          tx_status: body.tx_status?.toLowerCase() || transaction.tx_status,
          merchant_name: body.merchant_name || transaction.merchant_name || '',
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

// DELETE /api/onboarding/budget/manual/transactions/[transactionId]
// Delete the transaction in onboarding account
export const DELETE = enhanceRouteHandler(async ({ params, user }) => {
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { transactionId, budgetSlug } = params;
    const supabase = getSupabaseServerClient();
    const supabaseAdmin = getSupabaseServerAdminClient();

    // Fetch the current budget data
    const { data: dbBudgetData, error: fetchBudgetError } = await supabase
      .from('budgets')
      .select('id, current_onboarding_step, accounts!inner(slug)')
      .eq('accounts.slug', budgetSlug!)
      .single();

    if (fetchBudgetError || !dbBudgetData) {
      console.error('Error fetching budget:', fetchBudgetError);
      return NextResponse.json(
        { error: 'Failed to fetch budget' },
        { status: 500 },
      );
    }

    if (
      !['start', 'plaid', 'manual'].includes(
        dbBudgetData.current_onboarding_step,
      )
    ) {
      return NextResponse.json(
        { error: 'Onboarding not in correct state' },
        { status: 409 },
      );
    }

    // Verify transaction belongs to user's manual account
    const { data: transaction, error: transactionError } = await supabase
      .from('fin_account_transactions')
      .select(
        `
          *,
          manual_fin_accounts!inner (
            manual_fin_institutions!inner (
              owner_account_id
            )
          )
        `,
      )
      .eq('id', transactionId as string)
      .single();

    if (transactionError?.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 },
      );
    }

    if (transactionError) {
      throw new Error(
        `Failed to fetch transaction: ${transactionError.message}`,
      );
    }

    if (
      !transaction ||
      transaction.manual_fin_accounts.manual_fin_institutions
        .owner_account_id !== user.id
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Use supabaseAdmin for deletion
    const { data, error } = await supabaseAdmin
      .from('fin_account_transactions')
      .delete()
      .eq('id', transactionId as string)
      .select();

    if (error) {
      throw new Error(`Failed to delete transaction: ${error.message}`);
    }

    return NextResponse.json(
      {
        message: 'Transaction deleted successfully',
        data,
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('Transaction deletion failed:', err.message);
    return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
  }
}, {});
