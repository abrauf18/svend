import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { BudgetSpendingTrackingsByMonth } from '~/lib/model/budget.types';
import { createBudgetService } from '~/lib/server/budget.service';
import { createCategoryService } from '~/lib/server/category.service';

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM format
  categorySpending: z.record(z.object({
    groupName: z.string(),
    target: z.number(),
    isTaxDeductible: z.boolean(),
    targetSource: z.enum(['group', 'category']),
    categories: z.array(z.object({
      categoryName: z.string(),
      target: z.number(),
      isTaxDeductible: z.boolean(),
    })),
  })),
});
// PUT /api/budgets/[budgetId]/spending-tracking
// Update spending tracking for a budget
export const PUT = enhanceRouteHandler(
  async ({ body, params }) => {
    if (!params.budgetId) {
      return NextResponse.json({ error: 'Budget ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
  
    // authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseServerAdminClient();

    // Check if the user has permission to update the budget
    const budgetService = createBudgetService(supabaseAdmin);
    const hasPermission = await budgetService.hasPermission({
      budgetId: params.budgetId,
      userId: user.id,
      permission: 'budgets.write'
    });

    if (!hasPermission) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const categoryService = createCategoryService(supabaseAdmin);

      // Fetch both current budget and categories in parallel
      const [currentBudget, categoryGroups] = await Promise.all([
        supabaseAdmin
          .from('budgets')
          .select('spending_tracking')
          .eq('id', params.budgetId)
          .single(),
        categoryService.getBudgetCategoryGroups(params.budgetId)
      ]);

      if (currentBudget.error) {
        if (currentBudget.error.code === 'PGRST116') {
          // PGRST116 is the error code for "not found" in PostgREST
          console.error('Budget not found:', params.budgetId);
          return NextResponse.json(
            { error: 'Budget not found' },
            { status: 404 }
          );
        }
        
        console.error('Error getting budget:', currentBudget.error);
        return NextResponse.json(
          { error: 'Failed to get budget' },
          { status: 500 }
        );
      }
      if (categoryGroups.error) {
        console.error('Error getting category groups:', categoryGroups.error);
        return NextResponse.json(
          { error: 'Failed to get category groups' },
          { status: 500 }
        );
      }

      // Validate all groups and categories exist before updating
      for (const [groupName, group] of Object.entries(body.categorySpending)) {
        const categoryGroup = Object.values(categoryGroups).find(g => g.name === groupName);
        if (!categoryGroup) {
          console.error(`Category group not found: ${groupName}`);
          return NextResponse.json(
            { error: `Category group not found: ${groupName}` },
            { status: 404 }
          );
        }

        for (const cat of group.categories) {
          const category = categoryGroup.categories.find(c => c.name === cat.categoryName);
          if (!category) {
            console.error(`Category not found: ${cat.categoryName} in group ${groupName}`);
            return NextResponse.json(
              { error: `Category not found: ${cat.categoryName} in group ${groupName}` },
              { status: 404 }
            );
          }
        }
      }

      // Update the spending tracking for the specific month
      const existingMonthData = (currentBudget.data.spending_tracking as BudgetSpendingTrackingsByMonth)[body.date];
      
      const updatedSpendingTracking = {
        ...(currentBudget.data.spending_tracking as BudgetSpendingTrackingsByMonth),
        [body.date]: Object.fromEntries(
          Object.entries(body.categorySpending).map(([groupName, group]) => {
            const categoryGroup = Object.values(categoryGroups).find(g => g.name === groupName)!; // Safe to use ! after validation
            
            return [
              groupName,
              {
                groupName: group.groupName,
                groupId: categoryGroup.id,
                targetSource: group.targetSource,
                spendingActual: existingMonthData?.[groupName]?.spendingActual ?? 0,
                spendingTarget: group.target,
                isTaxDeductible: group.isTaxDeductible,
                categories: group.categories.map(cat => {
                  const category = categoryGroup.categories.find(c => c.name === cat.categoryName)!; // Safe to use ! after validation
                  const existingCategory = existingMonthData?.[groupName]?.categories
                    .find(c => c.categoryName === cat.categoryName);
                  
                  return {
                    categoryName: cat.categoryName,
                    categoryId: category.id,
                    spendingActual: existingCategory?.spendingActual ?? 0,
                    spendingTarget: cat.target,
                    isTaxDeductible: cat.isTaxDeductible,
                  };
                })
              }
            ];
          })
        )
      } as BudgetSpendingTrackingsByMonth;

      // Update the budget with the new spending tracking
      const { error: updateError } = await supabaseAdmin
        .from('budgets')
        .update({ 
          spending_tracking: updatedSpendingTracking,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.budgetId);

      if (updateError) {
        console.error('Error updating budget:', updateError);
        return NextResponse.json(
          { error: 'Failed to update budget spending' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: 'Budget spending updated successfully',
        success: true,
        spendingTracking: updatedSpendingTracking
      });
    } catch (error) {
      console.error('Error updating budget spending:', error);
      return NextResponse.json(
        { error: 'Failed to update budget spending' },
        { status: 500 }
      );
    }
  },
  {
    schema,
  }
);
