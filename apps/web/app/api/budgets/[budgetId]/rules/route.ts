import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createRulesService } from '~/lib/server/rules.service';
import { createTransactionService } from '~/lib/server/transaction.service';

const createSchema = z.object({
  name: z.string().min(1, 'Rule name is required'),
  description: z.string().optional(),
  budgetId: z.string().uuid(),
  conditions: z.object({
    merchantName: z.object({
      enabled: z.boolean(),
      matchType: z.enum(['contains', 'exactly']).optional(),
      value: z.string().optional(),
    }),
    amount: z.object({
      enabled: z.boolean(),
      type: z.enum(['expenses', 'income']).optional(),
      matchType: z.enum(['exactly', 'between']).optional(),
      value: z.string().optional(),
      rangeStart: z.string().optional(),
      rangeEnd: z.string().optional(),
    }),
    date: z.object({
      enabled: z.boolean(),
      matchType: z.enum(['between', 'exactly']).optional(),
      value: z.coerce.number().optional(),
      rangeStart: z.coerce.number().optional(),
      rangeEnd: z.coerce.number().optional(),
    }),
    account: z.object({
      enabled: z.boolean(),
      value: z.string().optional(),
    }),
  }).transform(conditions => {
    const cleanedConditions: any = {};
    for (const [key, condition] of Object.entries(conditions)) {
      if (!condition.enabled) {
        cleanedConditions[key] = { enabled: false };
      } else {
        cleanedConditions[key] = condition;
      }
    }
    return cleanedConditions;
  }),
  actions: z.object({
    renameMerchant: z.object({
      enabled: z.boolean(),
      value: z.string().optional(),
    }),
    setNote: z.object({
      enabled: z.boolean(),
      value: z.string().optional(),
    }),
    setCategory: z.object({
      enabled: z.boolean(),
      value: z.string().optional(),
    }),
    addTags: z.object({
      enabled: z.boolean(),
      value: z.array(z.string()).optional(),
    }),
  }).transform(actions => {
    const cleanedActions: any = {};
    for (const [key, action] of Object.entries(actions)) {
      if (!action.enabled) {
        cleanedActions[key] = { enabled: false };
      } else {
        cleanedActions[key] = action;
      }
    }
    return cleanedActions;
  }),
  isActive: z.boolean().default(true),
  isAppliedToAllTransactions: z.boolean().default(false),
});

const reorderSchema = z.object({
  ruleOrders: z.array(z.string().uuid()),
});

// POST /api/budgets/[budgetId]/rules (create)
export const POST = enhanceRouteHandler(
  async ({ body }) => {
    const supabaseAdmin = getSupabaseServerAdminClient();
    const transactionService = createTransactionService(supabaseAdmin);
    const rulesService = createRulesService(supabaseAdmin, transactionService);

    const { data: rule, error } = await rulesService.createRule(body);

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      rule,
    });
  },
  { schema: createSchema }
);

// PATCH /api/budgets/[budgetId]/rules (reorder)
export const PATCH = enhanceRouteHandler(
  async ({ body, params }) => {
    const supabaseAdmin = getSupabaseServerAdminClient();
    const transactionService = createTransactionService(supabaseAdmin);
    const rulesService = createRulesService(supabaseAdmin, transactionService);

    const { error } = await rulesService.updateRuleOrder(params.budgetId as string, body.ruleOrders);

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  },
  { schema: reorderSchema }
); 
