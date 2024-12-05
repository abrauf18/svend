import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { BudgetSpendingCategoryGroupTracking, BudgetSpendingTrackingsByMonth } from '~/lib/model/budget.types';
import { createOnboardingService } from '~/lib/server/onboarding.service';
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

// PUT /api/onboarding/account/budget/spending
// Update budget category group spending (end account onboarding)
export const PUT = enhanceRouteHandler(
  async ({ body }) => {
    const supabaseClient = getSupabaseServerClient();
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdminClient = getSupabaseServerAdminClient();

    const { data: dbAccountOnboardingState, error: fetchOnboardingError } = await supabaseAdminClient
      .from('user_onboarding')
      .select('state->account')
      .eq('user_id', user.id)
      .single();

    if (fetchOnboardingError) {
      console.error('Error fetching onboarding state:', fetchOnboardingError);
      return NextResponse.json({ error: 'Failed to fetch onboarding state' }, { status: 500 });
    }

    const startingContextKey = (dbAccountOnboardingState.account as any)?.contextKey;
    if (startingContextKey !== 'budget_setup') {
      return NextResponse.json({ error: 'Invalid state: ' + startingContextKey }, { status: 400 });
    }

    const budgetId = (dbAccountOnboardingState.account as any)?.budgetId;

    // -------------------------------------------------
    // Fetch current spending tracking data
    // -------------------------------------------------
    const { data: dbBudgetData, error: fetchError } = await supabaseAdminClient
      .from('budgets')
      .select('spending_tracking, team_account_id, accounts(slug)')
      .eq('id', budgetId)
      .single();

    if (fetchError) {
      console.error('Error fetching current budget:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch current budget' }, { status: 500 });
    }

    // Get the latest month from the tracking data
    const currentTracking = dbBudgetData.spending_tracking as BudgetSpendingTrackingsByMonth;
    const months = Object.keys(currentTracking).sort();
    const latestMonth = months[months.length - 1]!;

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
    // Update budget category spending and retrieve data
    // -------------------------------------------------
    const { error: updateError } = await supabaseAdminClient
      .from('budgets')
      .update({ 
        spending_tracking: updatedTracking
      })
      .eq('id', budgetId);

    if (updateError) {
      console.error('Error updating budget category spending:', updateError);
      return NextResponse.json({ error: 'Failed to update budget category spending' }, { status: 500 });
    }
    
    if (!dbBudgetData?.accounts?.slug) {
      console.error('Budget slug not found');
      return NextResponse.json({ error: 'Budget slug not found' }, { status: 500 });
    }

    const budgetSlug = dbBudgetData.accounts.slug;

    // ----------------------------------------
    // Complete onboarding
    // ----------------------------------------
    const { error: updateOnboardingStepError } = await supabaseAdminClient
      .from('budgets')
      .update({ 
        current_onboarding_step: 'invite_members'
      })
      .eq('id', budgetId);

    if (updateOnboardingStepError) {
      console.error('Error updating current onboarding step:', updateOnboardingStepError);
      return NextResponse.json({ error: 'Failed to update current onboarding step' }, { status: 500 });
    }

    const onboardingService = createOnboardingService(supabaseAdminClient);

    const { error: updateErrorMessage } = await onboardingService.updateContextKey({
      userId: user.id,
      contextKey: 'end',
      validContextKeys: ['budget_setup', 'end']
    });
    if (updateErrorMessage) {
      return NextResponse.json({ error: 'Failed to update context key:' + updateErrorMessage }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Account onboarding completed successfully',
      budgetId: budgetId,
      budgetSlug: budgetSlug
    });
  },
  {
    schema,
  }
);
