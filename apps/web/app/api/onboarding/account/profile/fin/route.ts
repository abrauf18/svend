import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  annualIncome: z.string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val >= 0, 'Must be positive')
    .refine((val) => val <= 100000000, 'Must be less than $100M'),
  savings: z.string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val >= 0, 'Must be positive')
    .refine((val) => val <= 100000000, 'Must be less than $100M'),
});

export const PUT = enhanceRouteHandler(
  async ({ body, user }) => {
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    try {
      const supabaseAdmin = getSupabaseServerAdminClient();

      const { data, error } = await supabaseAdmin
        .from('acct_fin_profile')
        .update({
          annual_income: body.annualIncome,
          savings: body.savings,
        })
        .eq('account_id', user.id)
        .select();

      if (error) throw new Error(`Failed to update profile: ${error.message}`);

      return NextResponse.json({ message: 'Financial profile updated successfully', data });
    } catch (err: any) {
      console.error('Financial profile update failed:', err.message);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }
  },
  { schema },
);
