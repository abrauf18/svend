import { NextResponse } from "next/server";
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { createTransactionService } from "~/lib/server/transaction.service";
import { createPlaidClient } from "~/lib/server/plaid.service";
import { enhanceRouteHandler } from "@kit/next/routes";
import { z } from "zod";

// Define request schema
const syncTransactionsSchema = z.object({
    plaidConnectionItem: z.object({
        svendItemId: z.string()
    })
});

export const POST = enhanceRouteHandler(
    async ({ body, user }) => {
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabaseAdmin = getSupabaseServerAdminClient();

        // Get the item and verify ownership
        const { data: item, error: itemError } = await supabaseAdmin
            .from('plaid_connection_items')
            .select(`
                id,
                access_token,
                next_cursor,
                owner_account_id,
                plaid_accounts (
                    id,
                    plaid_account_id,
                    budget_fin_accounts (
                        id
                    )
                )
            `)
            .eq('id', body.plaidConnectionItem.svendItemId)
            .single();

        if (itemError || !item) {
            console.error('Error fetching plaid item:', itemError);
            return NextResponse.json({ error: 'Failed to fetch plaid item' }, { status: 500 });
        }

        // Verify ownership
        if (item.owner_account_id !== user.id) {
            return NextResponse.json({ error: 'Unauthorized access to plaid item' }, { status: 403 });
        }

        try {
            const transactionService = createTransactionService(supabaseAdmin);
            const plaidClient = createPlaidClient();

            const { data, error } = await transactionService.syncPlaidTransactionsFinAccountMgmt(
                [{
                    svendItemId: item.id,
                    accessToken: item.access_token,
                    nextCursor: item.next_cursor || '',
                    plaidAccounts: item.plaid_accounts.map(account => ({
                        svendAccountId: account.id,
                        plaidAccountId: account.plaid_account_id,
                        budgetFinAccountIds: account.budget_fin_accounts.map(ba => ba.id)
                    }))
                }],
                plaidClient
                // No budgetId provided - will only save regular fin account transactions
            );

            if (error) {
                console.error('Sync error:', error);
                return NextResponse.json({ error }, { status: 500 });
            }

            return NextResponse.json(data);
        } catch (error: any) {
            console.error('Error in sync transactions:', error);
            return NextResponse.json({ 
                error: error.message || 'An unexpected error occurred' 
            }, { status: 500 });
        }
    },
    { schema: syncTransactionsSchema }
);