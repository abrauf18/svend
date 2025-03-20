import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const accountSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Name should have between 1 and 50 characters' })
    .max(50, { message: 'Name should have between 1 and 50 characters' }),
  type: z.enum(['depository', 'credit', 'loan', 'investment', 'other'], {
    errorMap: () => ({ message: 'Please select a valid account type' }),
  }),
  mask: z
    .string()
    .length(4, { message: 'Mask must be 4 characters long' })
    .refine((data) => (data.match(/[^0-9]/g) ? false : true), {
      message: 'Mask should contain only numbers',
    }),
  institutionId: z.string().min(1, { message: 'Institution is required' }),
  balanceCurrent: z.number().min(0, { message: 'Balance must be 0 or greater' }),
});

// POST /api/fin-account-mgmt/manual/accounts
// Create a new account
export const POST = enhanceRouteHandler(
  async ({ body, user }) => {
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      const { name, institutionId, type, mask, balanceCurrent } = body;
      const supabase = getSupabaseServerClient();
      const supabaseAdmin = getSupabaseServerAdminClient();
      
      // Verify institution belongs to user
      const { data: institution, error: institutionError } = await supabase
        .from('manual_fin_institutions')
        .select('owner_account_id')
        .eq('id', institutionId)
        .single();

      if (institutionError || !institution) {
        throw new Error('Failed to fetch institution');
      }

      if (institution.owner_account_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      // Create the account
      const { data: insertedAccounts, error: accountsError } = await supabaseAdmin
        .from('manual_fin_accounts')
        .insert({
          owner_account_id: user.id,
          institution_id: institutionId,
          type,
          name,
          mask,
          balance_current: balanceCurrent,
        })
        .select('id');

      if (accountsError) throw accountsError;
      if (!insertedAccounts?.length) throw new Error('No accounts were returned');

      return NextResponse.json(
        {
          message: 'Account created successfully',
          accountId: insertedAccounts[0]?.id,
        },
        { status: 200 },
      );
    } catch (err: any) {
      console.error('Account creation failed:', err.message);
      return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
    }
  },
  { schema: accountSchema },
);
