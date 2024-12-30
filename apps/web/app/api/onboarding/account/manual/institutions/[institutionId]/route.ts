import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// DELETE /api/onboarding/account/manual/institutions/[institutionId]
// Delete a manual account
export const DELETE = enhanceRouteHandler(
  async ({ params }) => {
    try {
      const { institutionId } = params;

      if (!institutionId) throw new Error('Institution ID is required');

      const supabaseAdmin = getSupabaseServerAdminClient();

      const { error: institutionError } = await supabaseAdmin.rpc(
        'delete_manual_institutions_accounts_and_transactions',
        { p_manual_institution_ids: [institutionId] },
      );

      if (institutionError) throw institutionError;

      return NextResponse.json({ data: 'ok' }, { status: 200 });
    } catch (err: any) {
      console.error(err);

      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  },
  { auth: false },
);

// PUT /api/onboarding/account/manual/institutions/[institutionId]
// Update a manual account

const putSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Name should have between 1 and 50 characters' })
    .max(50, { message: 'Name should have between 1 and 50 characters' }),
  symbol: z
    .string({
      invalid_type_error: 'Invalid symbol',
      required_error: 'Symbol is a required field',
    })
    .min(3, { message: 'Symbol must be at least 3 characters long' })
    .max(5, { message: 'Symbol must be 3 to 5 characters long' })
    .refine(
      (data) => {
        if (data.match(/[0-9]/g)) return false;
        return true;
      },
      { message: 'Numbers are not allowed' },
    )
    .transform((data) => data.trim().toUpperCase().replace(/[0-9]/g, '')),
});

export const PUT = enhanceRouteHandler(
  async ({ params, body }) => {
    try {
      const { institutionId } = params;
      const { name, symbol } = body;

      const supabaseAdmin = getSupabaseServerAdminClient();

      const { error: institutionError } = await supabaseAdmin
        .from('manual_fin_institutions')
        .update({
          name,
          symbol,
        })
        .eq('id', institutionId!);

      if (institutionError) throw institutionError;

      return NextResponse.json({ data: 'ok' }, { status: 200 });
    } catch (err: any) {
      console.error(err);

      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  },
  { auth: false, schema: putSchema },
);
