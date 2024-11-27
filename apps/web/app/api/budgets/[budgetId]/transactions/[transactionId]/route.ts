import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createBudgetService } from '~/lib/server/budget.service';

const schema = z.object({
  categoryId: z.string().uuid().optional(),
  merchantName: z.string().optional(),
  payee: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.object({ id: z.string().uuid() }))
});

// PUT /api/budgets/[budgetId]/transactions/[transactionId]
// Update a transaction
export const PUT = enhanceRouteHandler(
  async ({ body, params }) => {
    if (!params.budgetId || !params.transactionId) {
      return NextResponse.json({ error: 'Budget ID and Transaction ID are required' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    
    // authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    
    // Build update object only with provided fields
    const updateData: Record<string, any> = {};
    
    if (body.categoryId) updateData.svend_category_id = body.categoryId;
    if (body.merchantName !== undefined) updateData.merchant_name = body.merchantName;
    if (body.payee !== undefined) updateData.payee = body.payee;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.tags) updateData.tag_ids = body.tags.map(tag => tag.id);
    
    // Only proceed with update if there are fields to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: 'No fields to update' }, { status: 400 });
    }
    
    const supabaseAdmin = getSupabaseServerAdminClient();

    // Check if the user has permission to update the transaction
    const budgetService = createBudgetService(supabaseAdmin);
    const hasPermission = await budgetService.hasPermission({
      budgetId: params.budgetId,
      userId: user.id,
      permission: 'budgets.write'
    });

    if (!hasPermission) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update the transaction with only the provided fields
    const { data: dbTransactionData, error: updateError } = await supabaseAdmin
      .from('budget_fin_account_transactions')
      .update(updateData)
      .eq('budget_id', params.budgetId)
      .eq('fin_account_transaction_id', params.transactionId)
      .select('fin_account_transactions (date)')
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: `Error updating transaction: ${updateError.message}` },
        { status: 500 }
      );
    }

    // TODO: convert to function to make transaction in case of category change
    if (body.categoryId) {
      const transactionDate = dbTransactionData.fin_account_transactions!.date;
      const formattedDate = new Date(transactionDate).toISOString().slice(0, 7); // formats to YYYY-MM
      const { error: recalculateSpendingError } = await budgetService.updateRecalculateSpending(params.budgetId, [formattedDate]);
      if (recalculateSpendingError) {
        return NextResponse.json({ error: `Error recalculating spending after transaction category change: ${recalculateSpendingError}` }, { status: 500 });
      }
    }

    return NextResponse.json({ message: 'Transaction updated successfully' });
  },
  {
    schema,
  }
);

