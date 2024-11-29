import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createBudgetService } from '~/lib/server/budget.service';

const schema = z.object({
  categoryId: z.string().uuid().optional(),
  notes: z.string().optional(),
  tags: z.array(z.object({ id: z.string().uuid() }))
});

// PUT /api/budgets/[budgetId]/transactions-recurring/[transactionId]
// Update a recurring transaction
export const PUT = enhanceRouteHandler(
  async ({ body, params }) => {
    if (!params.budgetId || !params.transactionId) {
      return NextResponse.json({ error: 'Budget ID and RecurringTransaction ID are required' }, { status: 400 });
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
      .from('budget_fin_account_recurring_transactions')
      .update(updateData)
      .eq('budget_id', params.budgetId)
      .eq('fin_account_recurring_transaction_id', params.transactionId)
      .select();

    if (updateError) {
      return NextResponse.json(
        { error: `Error updating transaction: ${updateError.message}` },
        { status: 500 }
      );
    }

    if (!dbTransactionData || dbTransactionData.length === 0) {
      return NextResponse.json(
        { error: 'Recurring transaction not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Transaction updated successfully' });
  },
  {
    schema,
  }
);

