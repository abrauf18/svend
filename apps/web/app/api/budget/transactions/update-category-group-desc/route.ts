import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  groupId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  groupDescription: z.string().optional(),
  categoryDescription: z.string().optional(),
}).refine(
  data => {
    // If groupId is provided, groupDescription must be provided (including empty string)
    if (data.groupId && data.groupDescription === undefined) return false;
    // If categoryId is provided, categoryDescription must be provided (including empty string)
    if (data.categoryId && data.categoryDescription === undefined) return false;
    // At least one update must be requested
    return !!(data.groupId || data.categoryId);
  },
  { message: "Invalid input combination" }
);

// PUT /api/budget/transactions/update-category-group-desc
export const PUT = enhanceRouteHandler(
  async ({ body }) => {
    const supabaseAdmin = getSupabaseServerAdminClient();

    if (body.groupId) {
      const { data: groupData, error: groupError } = await supabaseAdmin
        .from('category_groups')
        .update({ description: body.groupDescription })
        .eq('id', body.groupId)
        .not('budget_id', 'is', null)
        .select()
        .maybeSingle();

      if (groupError) {
        return NextResponse.json(
          { success: false, error: groupError.message },
          { status: 500 }
        );
      }

      if (!groupData) {
        return NextResponse.json(
          { success: false, error: 'Cannot modify built-in category group' },
          { status: 403 }
        );
      }
    }

    if (body.categoryId) {
      const { data: categoryData, error: categoryError } = await supabaseAdmin
        .from('categories')
        .update({ description: body.categoryDescription })
        .eq('id', body.categoryId)
        .not('budget_id', 'is', null)
        .select()
        .maybeSingle();

      if (categoryError) {
        return NextResponse.json(
          { success: false, error: categoryError.message },
          { status: 500 }
        );
      }

      if (!categoryData) {
        return NextResponse.json(
          { success: false, error: 'Cannot modify built-in category' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ success: true });
  },
  { schema }
);
