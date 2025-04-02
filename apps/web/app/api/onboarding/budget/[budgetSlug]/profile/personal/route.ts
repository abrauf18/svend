import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  fullName: z.string().min(1, { message: 'Name is required' }),
  age: z.number({
    required_error: 'Age is required',
    invalid_type_error: 'Age must be a valid number',
  }).min(5, 'Age must be at least 5').max(120, 'Age must be less than 120'),
});

export const PUT = enhanceRouteHandler(
  async ({ body, user }) => {
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    try {
      const supabaseAdmin = getSupabaseServerAdminClient();

      const { data, error } = await supabaseAdmin
        .rpc('update_account_profile', {
          p_user_id: user.id,
          p_full_name: body.fullName,
          p_age: body.age
        });

      if (error) {
        throw new Error(`Failed to update profile: ${error.message}`);
      }

      return NextResponse.json({ 
        message: 'Profile updated successfully',
        data 
      });
    } catch (err: any) {
      console.error('Profile update failed:', err.message);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }
  },
  { schema },
);
