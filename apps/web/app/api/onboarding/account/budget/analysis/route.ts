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
      console.error('[budget/analysis] Analysis error:', analysisError);
      const statusCode = analysisError.startsWith('CLIENT_ERROR:') ? 400 : 500;
      return NextResponse.json({ 
        error: analysisError,
        context: 'budget_analysis'
      }, { status: statusCode });
    }

    return NextResponse.json({
      success: true,
      message: 'Budget analysis completed successfully',
      analysisResult
    });

  } catch (error: any) {
    console.error('[budget/analysis] Unexpected error:', error);
    return NextResponse.json({ 
      error: `SERVER_ERROR:[budget/analysis] Unexpected error: ${error.message}`,
      context: 'budget_analysis'
    }, { status: 500 });
  }
}
