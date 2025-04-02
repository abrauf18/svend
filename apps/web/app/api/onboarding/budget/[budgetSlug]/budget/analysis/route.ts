import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { createOnboardingService } from '~/lib/server/onboarding.service';
import { Configuration } from 'plaid';
import { PlaidEnvironments } from 'plaid';

// POST /api/onboarding/budget/analysis
// Perform budget spending analysis
export async function POST(request: Request, { params }: { params: { budgetSlug: string } }) {
  try {
    const supabaseClient = getSupabaseServerClient();
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { budgetSlug } = params;
    
    // Fetch the budget by slug
    const { data: dbBudgetData, error: fetchBudgetError } = await supabaseClient
      .from('budgets')
      .select('id, current_onboarding_step, accounts!inner(slug)')
      .eq('accounts.slug', budgetSlug)
      .single();

    if (fetchBudgetError || !dbBudgetData) {
      console.error('Error fetching budget:', fetchBudgetError);
      return NextResponse.json({ error: 'Failed to fetch budget' }, { status: 500 });
    }

    const plaidConfiguration = new Configuration({
      basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
          'PLAID-SECRET': process.env.PLAID_SECRET,
        },
      },
    });
    
    const onboardingService = createOnboardingService(getSupabaseServerAdminClient(), plaidConfiguration);

    // Perform analysis using the budgetId from the fetched budget
    const { data: analysisResult, error: analysisError } = await onboardingService.budgetAnalysisForBudget(
      user.id, 
      dbBudgetData.id,
      dbBudgetData.current_onboarding_step
    );

    if (analysisError) {
      // Log the detailed error for debugging
      console.error('[budget/analysis] Analysis error:', {
        error: analysisError,
        userId: user.id,
        budgetId: dbBudgetData.id,
        timestamp: new Date().toISOString()
      });

      // Return a generic error message to the client
      const statusCode = analysisError.startsWith('CLIENT_ERROR:') ? 400 : 500;
      const clientMessage = statusCode === 400 
        ? 'invalid onboarding state' 
        : 'an unexpected error occurred';

      return NextResponse.json({ 
        error: clientMessage,
        context: 'budget_analysis'
      }, { status: statusCode });
    }

    return NextResponse.json({
      success: true,
      message: 'Budget analysis completed successfully',
      analysisResult
    });

  } catch (error: any) {
    // Log the detailed error for debugging
    console.error('[budget/analysis] Unexpected error:', {
      error: error,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Return a generic error message to the client
    return NextResponse.json({ 
      error: 'An unexpected error occurred',
      context: 'budget_analysis'
    }, { status: 500 });
  }
}