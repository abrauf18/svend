import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createBudgetService } from '~/lib/server/budget.service';

const schema = z.object({
  tagName: z.string().min(1),
});

export const POST = enhanceRouteHandler(
  async ({ body, params }) => {
    if (!params.budgetId) {
      return NextResponse.json({ error: 'Budget ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
  
    // authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseServerAdminClient();

    // authorize user for budgets.write permission
    const budgetService = createBudgetService(supabaseAdmin);
    const hasPermission = await budgetService.hasPermission({
      budgetId: params.budgetId,
      userId: user.id,
      permission: 'budgets.write'
    });
    if (!hasPermission) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: newTag, error: createError } = await supabaseAdmin.rpc('create_budget_tag', {
      p_budget_id: params.budgetId,
      p_tag_name: body.tagName,
    });

    if (createError) {
      console.error('Error creating budget tag:', createError);
      return NextResponse.json(
        { error: 'Failed to create budget tag' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Budget tag created successfully',
      success: true,
      tag: {
        id: newTag?.id,
        name: newTag?.name,
      }
    });
  },
  {
    schema,
  }
);
