import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const institutionSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Name should have between 1 and 50 characters' })
    .max(50, { message: 'Name should have between 1 and 50 characters' }),
  symbol: z
    .string({
      invalid_type_error: 'Invalid symbol',
      required_error: 'Symbol is required',
    })
    .min(3)
    .max(5),
});

// POST /api/onboarding/budget/manual/institutions
// Create a new institution
export const POST = enhanceRouteHandler(
  async ({ body, params, user }) => {
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      const { budgetSlug } = params;
      const { name, symbol } = body;
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

      // Create the institution
      const { data, error } = await supabaseAdmin
        .from('manual_fin_institutions')
        .insert({
          name,
          owner_account_id: user.id,
          symbol,
          meta_data: {
            created_for: dbBudgetData.id || '',
          },
        })
        .select('id');

      if (error) throw error;
      if (!data?.length)
        throw new Error('No data was returned from the database');

      return NextResponse.json(
        {
          message: 'Institution created successfully',
          institutionId: data[0]?.id,
        },
        { status: 200 },
      );
    } catch (err: any) {
      console.error('Institution creation failed:', err.message);
      return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
    }
  },
  { schema: institutionSchema },
);
