import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  groupId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  groupDescription: z.string().optional(),
  categoryDescription: z.string().optional(),
  isComposite: z.boolean().optional(),
  compositeData: z.array(z.object({
    categoryId: z.string().uuid(),
    categoryName: z.string().min(1, 'Category name is required'),
    weight: z.number()
  })).nullable().optional(),
}).refine(
  data => {
    // If groupId is provided, groupDescription must be provided (including empty string)
    if (data.groupId && data.groupDescription === undefined) return false;
    // If categoryId is provided, categoryDescription must be provided (including empty string)
    if (data.categoryId && data.categoryDescription === undefined) return false;
    // At least one update must be requested
    if (data.isComposite && (!data.compositeData || data.compositeData.length < 2)) return false;
    return !!(data.groupId ?? data.categoryId);
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
        console.error('Error updating category group:', groupError);
        return NextResponse.json(
          { success: false, error: 'An error occurred while updating the category group' },
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
      const updateData: any = {
        description: body.categoryDescription
      };

      if (body.isComposite !== undefined) {
        updateData.is_composite = body.isComposite;
        if (body.isComposite) {
          updateData.composite_data = body.compositeData?.map(item => ({
            categoryId: item.categoryId,
            weight: item.weight,
            categoryName: item.categoryName
          })) ?? null;
        }
      }

      const { data: categoryData, error: categoryError } = await supabaseAdmin
        .from('categories')
        .update(updateData)
        .eq('id', body.categoryId)
        .not('budget_id', 'is', null)
        .select()
        .maybeSingle();

      if (categoryError) {
        console.error('Error updating category:', categoryError);
        return NextResponse.json(
          { success: false, error: 'An error occurred while updating the category' },
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
