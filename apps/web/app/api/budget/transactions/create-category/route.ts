import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Category } from '~/lib/model/fin.types';

const MAX_NAME_LENGTH = 50;
const VALID_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9\s\-_]*$/;

const schema = z.object({
  categoryName: z.string()
    .min(1, 'Category name is required')
    .max(MAX_NAME_LENGTH, `Category name must be ${MAX_NAME_LENGTH} characters or less`)
    .regex(VALID_NAME_REGEX, 'Category name must start with a letter and can only contain letters, numbers, spaces, dashes, and underscores')
    .transform(name => name.charAt(0).toUpperCase() + name.slice(1)),
  description: z.string().optional(),
  groupId: z.string().uuid(),
  budgetId: z.string().uuid()
});

// PUT /api/budget/transactions/create-category
export const PUT = enhanceRouteHandler(
  async ({ body }) => {
    const supabaseAdmin = getSupabaseServerAdminClient();

    // Check if group exists (not built-in) and category name is unique
    const { data: validation, error: validationError } = await supabaseAdmin
      .from('category_groups')
      .select(`
        budget_id,
        categories!left (
          id,
          name
        )
      `)
      .eq('id', body.groupId)
      .ilike('categories.name', body.categoryName)
      .single();

    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError.message },
        { status: 500 }
      );
    }

    // Group doesn't exist
    if (!validation) {
      return NextResponse.json(
        { success: false, error: 'Category group not found' },
        { status: 404 }
      );
    }

    // Group is built-in
    if (validation.budget_id === null) {
      return NextResponse.json(
        { success: false, error: 'Cannot create categories under built-in groups' },
        { status: 400 }
      );
    }

    // Category name already exists
    if (validation.categories?.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Category name already exists for this group.' },
        { status: 400 }
      );
    }

    // Create the new category
    const { data: newCategory, error: createError } = await supabaseAdmin
      .from('categories')
      .insert({
        name: body.categoryName,
        description: body.description,
        budget_id: body.budgetId,
        group_id: body.groupId,
      })
      .select()
      .single();

    if (createError) {
      return NextResponse.json(
        { success: false, error: createError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      category: {
        id: newCategory.id,
        name: newCategory.name,
        description: newCategory.description,
        createdAt: newCategory.created_at,
        groupId: newCategory.group_id,
        updatedAt: newCategory.updated_at,
      } as Category,
    });
  },
  { schema }
);
