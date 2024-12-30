import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// POST /api/onboarding/account/manual/institutions
// Create a new institution

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

export const POST = enhanceRouteHandler(
  async ({ body }) => {
    try {
      const { name, symbol } = body;

      const supabaseClient = getSupabaseServerClient();
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();

      if (!user) throw new Error('User not found');

      const supabaseAdminClient = getSupabaseServerAdminClient();

      const { data, error } = await supabaseAdminClient
        .from('manual_fin_institutions')
        .insert({ name, owner_account_id: user.id, symbol })
        .select('id');

      if (error) throw new Error(error.message);
      if (!data) throw new Error('No data was returned from the database');

      return NextResponse.json(
        {
          message:
            '[Create Institution Endpoint] Institution created successfully',
          institutionId: data[0]?.id,
        },
        { status: 200 },
      );
    } catch (err: any) {
      console.error(
        `[Create Institution Endpoint] Error while creating institution: ${err.message}`,
      );

      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  },
  { auth: false, schema: institutionSchema },
);
