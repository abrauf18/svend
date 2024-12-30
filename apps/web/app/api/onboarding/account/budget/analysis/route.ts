import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { createOnboardingService } from '~/lib/server/onboarding.service';
import { Configuration } from 'plaid';
import { PlaidEnvironments } from 'plaid';

// POST /api/onboarding/account/budget/analysis
// Perform budget spending analysis
export async function POST(request: Request) {
  try {
    const supabaseClient = getSupabaseServerClient();
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Perform analysis
    const { data: analysisResult, error: analysisError } = await onboardingService.budgetAnalysis(user.id);

    if (analysisError) {
      // Log the detailed error for debugging
      console.error('[budget/analysis] Analysis error:', {
        error: analysisError,
        userId: user.id,
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
