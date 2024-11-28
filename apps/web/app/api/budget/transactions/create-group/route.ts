import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const MAX_NAME_LENGTH = 50;
const VALID_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9\s\-_]*$/;

const schema = z.object({
  groupName: z.string()
    .min(1, 'Group name is required')
    .max(MAX_NAME_LENGTH, `Group name must be ${MAX_NAME_LENGTH} characters or less`)
    .regex(VALID_NAME_REGEX, 'Group name must start with a letter and can only contain letters, numbers, spaces, dashes, and underscores')
    .transform(name => name.charAt(0).toUpperCase() + name.slice(1)),
  description: z.string().optional(),
  budgetId: z.string().uuid()
});

// PUT /api/budget/transactions/create-group
export const PUT = enhanceRouteHandler(
  async ({ body }) => {
    const supabaseAdmin = getSupabaseServerAdminClient();

    const { data: newGroup, error: createError } = await supabaseAdmin
      .rpc('create_budget_category_group', {
        p_budget_id: body.budgetId,
        p_name: body.groupName,
        p_description: body.description
      })
      .single();
    if (createError) {
      return NextResponse.json(
        { success: false, error: createError.message.startsWith('409:') ? createError.message.substring(4) : createError.message },
        { status: createError.message.startsWith('409:') ? 409 : 500 }  // Use 409 for conflict errors, otherwise 500
      );
    }

    return NextResponse.json({
      success: true,
      categoryGroup: {
        id: newGroup.id,
        name: newGroup.name,
        description: newGroup.description,
        budgetId: newGroup.budget_id,
        createdAt: newGroup.created_at,
        updatedAt: newGroup.updated_at,
        isEnabled: newGroup.is_enabled,
        categories: [],
      }
    });
  },
  { schema }
);