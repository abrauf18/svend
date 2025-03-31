import { createRulesService } from '~/lib/server/rules.service';
import { createTransactionService } from '~/lib/server/transaction.service';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';

export const DELETE = enhanceRouteHandler(async ({ params }) => {
  const supabaseAdmin = getSupabaseServerAdminClient();
  const transactionService = createTransactionService(supabaseAdmin);
  const rulesService = createRulesService(supabaseAdmin, transactionService);

  const { error } = await rulesService.deleteRule(params.ruleId as string);

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
});
