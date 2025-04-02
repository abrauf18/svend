import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { BudgetSpendingCategoryGroupTracking, BudgetSpendingTrackingsByMonth } from '~/lib/model/budget.types';
import { enhanceRouteHandler } from '@kit/next/routes';
import { z } from 'zod';

// Define the schema for category
const categorySchema = z.object({
  categoryName: z.string(),
  target: z.number(),
  isTaxDeductible: z.boolean()
});

// Define the schema for category group spending
const categoryGroupSpendingSchema = z.object({
  groupName: z.string(),
  target: z.number(),
  isTaxDeductible: z.boolean(),
  targetSource: z.enum(['group', 'category']),
  categories: z.array(categorySchema)
});

// Define the main request schema
const schema = z.object({
  categorySpending: z.record(categoryGroupSpendingSchema)
});

// PUT /api/onboarding/budget/[budgetSlug]/budget/spending
// Update budget category group spending for multi-budget onboarding
export const PUT = enhanceRouteHandler(
  async ({ body, params }) => {
    const budgetSlug = params.budgetSlug;
    if (!budgetSlug) {
      return NextResponse.json({ error: 'Budget slug is required' }, { status: 400 });
    }

    const supabaseClient = getSupabaseServerClient();
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdminClient = getSupabaseServerAdminClient();

    // -------------------------------------------------
    // Fetch current budget data using slug
    // -------------------------------------------------
    const { data: dbBudgetData, error: fetchError } = await supabaseAdminClient
      .from('budgets')
      .select('id, spending_tracking, team_account_id, current_onboarding_step, accounts!inner(slug)')
      .eq('accounts.slug', budgetSlug)
      .single();

    if (fetchError || !dbBudgetData) {
      console.error('Error fetching current budget:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch current budget' }, { status: 500 });
    }

    // Validate the onboarding step
    if (!['start', 'plaid', 'manual', 'budget_setup'].includes(dbBudgetData.current_onboarding_step)) {
      return NextResponse.json({ 
        error: 'Invalid onboarding step: ' + dbBudgetData.current_onboarding_step 
      }, { status: 400 });
    }

    const budgetId = dbBudgetData.id;

    // Get the latest month from the tracking data
    const currentTracking = dbBudgetData.spending_tracking as BudgetSpendingTrackingsByMonth || {};
    const months = Object.keys(currentTracking).sort();
    const latestMonth = months.length > 0 ? months[months.length - 1]! : new Date().toISOString().substring(0, 7); // YYYY-MM

    // Merge the new spending targets with existing tracking data
    const updatedTracking = {
      ...currentTracking,
      [latestMonth]: Object.entries(body.categorySpending).reduce<Record<string, BudgetSpendingCategoryGroupTracking>>((acc, [groupName, groupData]) => {
        const existingGroup = currentTracking[latestMonth]?.[groupName] || {
          groupName,
          spendingActual: 0,
          categories: []
        };

        // Update group level data
        acc[groupName] = {
          ...existingGroup,
          spendingTarget: groupData.target,
          isTaxDeductible: groupData.isTaxDeductible,
          targetSource: groupData.targetSource,
          categories: groupData.categories.map(newCat => {
            const existingCat = existingGroup.categories.find(c => c.categoryName === newCat.categoryName) || {
              categoryName: newCat.categoryName,
              spendingActual: 0
            };
            
            return {
              ...existingCat,
              spendingTarget: newCat.target,
              isTaxDeductible: newCat.isTaxDeductible
            };
          })
        };

        return acc;
      }, {} as Record<string, BudgetSpendingCategoryGroupTracking>)
    };

    // -------------------------------------------------
    // Update budget category spending
    // -------------------------------------------------
    const { error: updateError } = await supabaseAdminClient
      .from('budgets')
      .update({ 
        spending_tracking: updatedTracking,
        current_onboarding_step: 'invite_members'
      })
      .eq('id', budgetId);

    if (updateError) {
      console.error('Error updating budget category spending:', updateError);
      return NextResponse.json({ error: 'Failed to update budget category spending' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Budget onboarding spending setup completed successfully',
      budgetId: budgetId,
      budgetSlug: budgetSlug
    });
  },
  {
    schema,
  }
);