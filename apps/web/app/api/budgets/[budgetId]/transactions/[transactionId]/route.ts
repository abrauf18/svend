import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CategoryCompositionData } from '~/lib/model/fin.types';
import { createBudgetService } from '~/lib/server/budget.service';
import { createSpendingService } from '~/lib/server/spending.service';

const schema = z.object({
  categoryId: z.string().uuid().optional(),
  merchantName: z.string().optional(),
  payee: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.object({ id: z.string().uuid() })),
  isSplit: z.boolean().optional(),
  splitComponents: z.array(z.object({
    categoryId: z.string().uuid(),
    categoryName: z.string(),
    weight: z.number()
  }))
  .optional()
  .superRefine((components, ctx) => {
    const isSplit = (ctx as any)._parent?.data?.isSplit;
    if (!isSplit) return true;

    if (!components || components.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Split mode requires at least 2 components"
      });
      return false;
    }

    const total = components.reduce((sum, comp) => sum + comp.weight, 0);
    if (Math.abs(total - 100) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Total distribution must equal 100%"
      });
      return false;
    }

    return true;
  })
});

// PUT /api/budgets/[budgetId]/transactions/[transactionId]
// Update a transaction
export const PUT = enhanceRouteHandler(
  async ({ body, params }) => {

    console.log(body)
    console.log(params)
    if (!params.budgetId || !params.transactionId) {
      return NextResponse.json({ error: 'Budget ID and Transaction ID are required' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    
    // authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseServerAdminClient();
    const updateData: Record<string, any> = {};
    
    const res: {
      message: string;
      newCategoryId?: string;
      existingCategoryId?: string;
      spendingTracking?: any;
    } = { 
      message: 'Transaction updated successfully' 
    };

    if (body.isSplit && body.splitComponents) {
      const { data: categoryGroup, error: groupError } = await supabaseAdmin
        .from('category_groups')
        .select('id')
        .eq('budget_id', params.budgetId)
        .eq('name', params.budgetId)
        .single();

      if (groupError) {
        return NextResponse.json(
          { error: `Error finding category group: ${groupError.message}` },
          { status: 500 }
        );
      }

      const { data: existingCategories, error: searchError } = await supabaseAdmin
        .from('categories')
        .select('*')
        .eq('budget_id', params.budgetId)
        .eq('group_id', categoryGroup.id)
        .eq('is_composite', true);

      if (searchError) {
        return NextResponse.json(
          { error: `Error searching for existing categories: ${searchError.message}` },
          { status: 500 }
        );
      }

      const isSameComposition = (comp1: CategoryCompositionData[], comp2: CategoryCompositionData[]) => {
        if (comp1.length !== comp2.length) return false;
        
        const sortedComp1 = [...comp1].sort((a, b) => a.categoryId.localeCompare(b.categoryId));
        const sortedComp2 = [...comp2].sort((a, b) => a.categoryId.localeCompare(b.categoryId));
        
        return sortedComp1.every((item, index) => 
          item.categoryId === sortedComp2[index]?.categoryId && 
          item.weight === sortedComp2[index]?.weight
        );
      };

      const existingCategory = existingCategories?.find(cat => 
        cat.composite_data && isSameComposition(cat.composite_data as unknown as CategoryCompositionData[], body.splitComponents as unknown as CategoryCompositionData[])
      );

      let categoryToUse;

      if (existingCategory) {
        categoryToUse = existingCategory;
        res.existingCategoryId = existingCategory.id;
      } else {
        const { data: newCategory, error: categoryError } = await supabaseAdmin
          .from('categories')
          .insert({
            budget_id: params.budgetId,
            group_id: categoryGroup.id,
            is_composite: true,
            composite_data: body.splitComponents,
            name: 'temp',
            is_discretionary: false,
            description: 'Hidden split transaction category'
          })
          .select()
          .single();

        if (categoryError) {
          return NextResponse.json(
            { error: `Error creating hidden category: ${categoryError.message}` },
            { status: 500 }
          );
        }

        const { error: updateError } = await supabaseAdmin
          .from('categories')
          .update({ name: newCategory.id })
          .eq('id', newCategory.id);

        if (updateError) {
          return NextResponse.json(
            { error: `Error updating hidden category name: ${updateError.message}` },
            { status: 500 }
          );
        }

        categoryToUse = newCategory;
        res.newCategoryId = newCategory.id;
      }

      updateData.svend_category_id = categoryToUse.id;
    } else {
      if (body.categoryId) updateData.svend_category_id = body.categoryId;
    }
    
    if (body.merchantName !== undefined) updateData.merchant_name = body.merchantName;
    if (body.payee !== undefined) updateData.payee = body.payee;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.tags) updateData.tag_ids = body.tags.map(tag => tag.id);
    
    // Only proceed with update if there are fields to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: 'No fields to update' }, { status: 400 });
    }
    
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

    if (!dbTransactionData) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Recalculate spending independently of whether it's split or not
    const transactionDate = dbTransactionData.fin_account_transactions!.date;
    const formattedDate = new Date(transactionDate).toISOString().slice(0, 7);

    const spendingService = createSpendingService(supabaseAdmin);
    try {
      const { data: updatedSpendingTracking, error: recalculateSpendingError } = 
        await spendingService.updateRecalculateSpending(params.budgetId, [formattedDate]);
      
      if (recalculateSpendingError) {
        console.error('Spending recalculation error:', recalculateSpendingError);
        return NextResponse.json(
          { error: 'An error occurred while updating the transaction spending.' },
          { status: 500 }
        );
      }
      res.spendingTracking = updatedSpendingTracking;
    } catch (error) {
      console.error('Unexpected error during spending recalculation:', error);
      return NextResponse.json(
        { error: 'An unexpected error occurred while updating the transaction.' },
        { status: 500 }
      );
    }

    return NextResponse.json(res);
  },
  {
    schema,
  }
);
