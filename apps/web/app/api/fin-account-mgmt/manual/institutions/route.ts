import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
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

// POST /api/fin-account-mgmt/manual/institutions
// Create a new institution
export const POST = enhanceRouteHandler(
  async ({ body, user }) => {
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      const { name, symbol } = body;
      const supabaseAdmin = getSupabaseServerAdminClient();

      // Create the institution
      const { data, error } = await supabaseAdmin
        .from('manual_fin_institutions')
        .insert({ 
          name, 
          owner_account_id: user.id, 
          symbol 
        })
        .select('id');

      if (error) throw error;
      if (!data?.length) throw new Error('No data was returned from the database');

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
