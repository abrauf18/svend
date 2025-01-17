import { enhanceRouteHandler } from '@kit/next/routes';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  CSVProcessingError,
  CSVType,
  normalizeCategory,
} from '../[filename]/route';
import insertInstitutions from '../[filename]/_handlers/insert-institutions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import insertAccounts from '../[filename]/_handlers/insert-accounts';
import parseCSVResponse from '../[filename]/_utils/parse-csv-response';

// POST /api/onboarding/account/manual/csv/mapped
// Insert the mapped CSV data into the database

const postSchema = z.object({
  mappedCsv: z.array(z.record(z.string(), z.string())),
});

export const POST = enhanceRouteHandler(
  async ({ body }) => {
    try {
      const parsedText = body.mappedCsv as CSVType[];

      const supabaseAdmin = getSupabaseServerAdminClient();
      const supabaseClient = getSupabaseServerClient();

      const {
        data: { user },
        error: getUserError,
      } = await supabaseClient.auth.getUser();

      if (!user || getUserError) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 },
        );
      }

      const { data: dbAccountOnboardingData, error: fetchOnboardingError } =
        await supabaseAdmin
          .from('user_onboarding')
          .select('state->account')
          .eq('user_id', user.id)
          .single();

      if (fetchOnboardingError) throw fetchOnboardingError;

      const { data: insertedInstitutions, error: institutionsError } =
        await insertInstitutions({
          supabaseAdmin,
          parsedText,
          user,
        });

      if (institutionsError) {
        console.error('[CSV Processing] Failed to process institutions:', {
          error: institutionsError,
          details:
            typeof institutionsError === 'object'
              ? institutionsError
              : undefined,
          stack:
            institutionsError instanceof Error
              ? institutionsError.stack
              : undefined,
        });
        return NextResponse.json(
          {
            error: 'An unexpected error occurred while processing the CSV file',
          },
          { status: 500 },
        );
      }

      if (!insertedInstitutions) {
        console.error('[CSV Processing] No institutions were returned');
        return NextResponse.json(
          {
            error: 'An unexpected error occurred while processing the CSV file',
          },
          { status: 500 },
        );
      }

      const {
        insertedBudgetAccounts,
        insertedAccounts,
        error: budgetAccountsError,
      } = await insertAccounts({
        supabaseAdmin,
        parsedText,
        user,
        insertedInstitutions,
        budgetId: (dbAccountOnboardingData?.account as any)!.budgetId,
      });

      if (budgetAccountsError || !insertedBudgetAccounts) {
        throw new CSVProcessingError('Failed to process accounts from CSV');
      }

      //We fetch the built in categories
      const { data: builtInCategories, error: builtInCategoriesError } =
        await supabaseAdmin
          .from('built_in_categories')
          .select('category_id, category_name');

      if (builtInCategoriesError) throw builtInCategoriesError;
      if (!builtInCategories)
        throw new Error('[CSV Endpoint] No built in categories were returned');

      //We map through the accounts and create the transactions
      const insertedTransactions = insertedAccounts
        .map((acc) => {
          const transactionsRows = parsedText.filter(
            (row) =>
              row.AccountName === acc.name &&
              row.BankName.trim().toLowerCase() ===
                insertedInstitutions
                  .find((inst) => inst.id === acc.institution_id)
                  ?.name.trim()
                  .toLowerCase() &&
              row.BankSymbol.trim().toUpperCase() ===
                insertedInstitutions
                  .find((inst) => inst.id === acc.institution_id)
                  ?.symbol.trim()
                  .toUpperCase(),
          )!;

          return transactionsRows;
        })
        .flat();

      // Deduplicate transactions first
      const uniqueTransactions = insertedTransactions.filter(
        (trans, index, self) =>
          index ===
          self.findIndex((t) => t.TransactionId === trans.TransactionId),
      );

      // Check for existing transactions
      const { data: existingTransactions, error: existingTransactionsError } =
        await supabaseAdmin
          .from('fin_account_transactions')
          .select(
            `
            user_tx_id,
            manual_fin_accounts!inner(
              owner_account_id,
              id
            )
          `,
          )
          .in(
            'user_tx_id',
            uniqueTransactions.map((t) => t.TransactionId),
          )
          .eq('manual_fin_accounts.owner_account_id', user.id);

      if (existingTransactionsError) {
        console.error(
          '[CSV Processing] Error checking existing transactions:',
          existingTransactionsError,
        );
        throw existingTransactionsError;
      }

      // Filter out transactions that already exist
      const newTransactions = uniqueTransactions.filter(
        (trans) =>
          !existingTransactions?.some(
            (existing) => existing.user_tx_id === trans.TransactionId,
          ),
      );

      // Filter out transactions with invalid categories
      const validTransactions = newTransactions.filter((trans) => {
        const matchingCategory = builtInCategories.find(
          (cat) =>
            normalizeCategory(cat.category_name ?? '') ===
            normalizeCategory(trans.Category ?? ''),
        );

        if (!matchingCategory) {
          console.warn(
            `Skipping transaction ${trans.TransactionId}: Invalid category "${trans.Category}". Available categories:`,
            builtInCategories.map((c) => c.category_name),
          );
          return false;
        }
        return true;
      });

      // Only proceed with RPC call if we have valid transactions
      if (validTransactions.length > 0) {
        const { error: budgetFinAccountTransactionsError } =
          await supabaseAdmin.rpc('create_budget_fin_account_transactions', {
            p_budget_id: (dbAccountOnboardingData?.account as any).budgetId,
            p_transactions: validTransactions.map((trans) => {
              const matchingCategory = builtInCategories.find(
                (cat) =>
                  normalizeCategory(cat.category_name ?? '') ===
                  normalizeCategory(trans.Category ?? ''),
              );

              return {
                date: trans.Date,
                amount: parseFloat(trans.Amount),
                manual_account_id: insertedAccounts.find(
                  (acc) => acc.name === trans.AccountName,
                )?.id!,
                svend_category_id: matchingCategory!.category_id,
                budget_fin_account_id: insertedBudgetAccounts.find(
                  (fin_acc) =>
                    fin_acc.manual_account_id ===
                    insertedAccounts.find(
                      (acc) => acc.name === trans.AccountName,
                    )?.id!,
                )?.id!,
                merchant_name: trans.Merchant || null,
                payee: null,
                iso_currency_code: 'USD',
                plaid_category_detailed: null,
                plaid_category_confidence: null,
                tx_status: 'posted' as 'pending' | 'posted',
                plaid_raw_data: null,
                user_tx_id: trans.TransactionId,
                plaid_tx_id: null,
              };
            }),
          });

        if (budgetFinAccountTransactionsError)
          throw budgetFinAccountTransactionsError;
      }

      //With the returned ids, we fetch the transactions from "fin_account_transactions"
      const {
        data: insertedFinAccountTransactions,
        error: finAccountTransactionsError,
      } = await supabaseAdmin
        .from('fin_account_transactions')
        .select('*')
        .in(
          'user_tx_id',
          validTransactions.map((trans) => trans.TransactionId),
        );

      if (finAccountTransactionsError) throw finAccountTransactionsError;

      const parsedInstitutions = parseCSVResponse({
        insertedInstitutions,
        insertedAccounts,
        insertedBudgetAccounts,
        insertedFinAccountTransactions: insertedFinAccountTransactions ?? [],
      });

      return NextResponse.json({ institutions: parsedInstitutions });
    } catch (err: any) {
      console.error('[Mapped CSV Processing] Unexpected error:', {
        error: err,
        message: err.message,
        details: err.details,
        stack: err.stack,
      });

      return NextResponse.json(
        {
          error:
            'An unexpected error occurred while processing the mapped CSV file',
        },
        { status: 500 },
      );
    }
  },
  { auth: false, schema: postSchema },
);
