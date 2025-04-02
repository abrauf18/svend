import { z } from 'zod';
import papa from 'papaparse';

import { NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { CSVRow, CSV_VALID_COLUMNS } from '~/lib/model/onboarding.types';
import checkCSVValidity from '~/lib/utils/check-csv-validity';
import insertInstitutions from './_handlers/insert-institutions';
import insertAccounts from './_handlers/insert-accounts';
import { parseCSVResponse } from './_utils/parse-csv-response';
import { Database } from '~/lib/database.types';

const requestSchema = z.object({
  filename: z.string()
});

const csvValidProps = Object.fromEntries(
  CSV_VALID_COLUMNS.map(key => [key, true])
) as Record<typeof CSV_VALID_COLUMNS[number], boolean>;

// POST /api/onboarding/account/manual/csv
// Process a CSV file and insert the data into the database
export const POST = enhanceRouteHandler(
  async ({ body, user }) => {
    const supabase = getSupabaseServerClient();
    let budgetId: string;

    try {
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      // Check if user is in onboarding
      const { data: onboardingData, error: onboardingError } = await supabase
        .from('user_onboarding')
        .select('state->account')
        .eq('user_id', user.id)
        .single();

      if (onboardingError) {
        throw new Error(`Failed to fetch onboarding state: ${onboardingError.message}`);
      }

      const onboardingState = onboardingData?.account as any;
      if (!['start', 'plaid', 'manual'].includes(onboardingState.contextKey)) {
        return NextResponse.json({ error: 'User not in onboarding' }, { status: 403 });
      }

      budgetId = onboardingState.budgetId;
    } catch (err: any) {
      console.error('[Mapped CSV Authorization] Unexpected error:', {
        error: err,
        message: err.message,
        details: err.details,
        stack: err.stack,
      });
      return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
    }

    // Main try-catch block for CSV processing
    try {
      const { filename } = body;
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('onboarding_attachments')
        .download(filename);

      if (downloadError) throw downloadError;

      const text = await fileData.text();
      const { data: parsedText } = papa.parse<CSVRow>(text, { header: true });

      const { isValid, missingProps, mappableProps, invalidRows } = checkCSVValidity({
        csv: parsedText,
        csvValidProps,
      });

      if (!isValid) {
        return NextResponse.json({
          isValid: false,
          missingProps,
          mappableProps,
          csvData: parsedText
        }, {
          status: 400
        });
      }

      const supabaseAdmin = getSupabaseServerAdminClient();
      const { data: insertedInstitutions, error: institutionsError, repeatedInstitutions } =
        await insertInstitutions({
          supabaseAdmin,
          parsedText,
          userId: user!.id,
          budgetId
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
        data,
        error: budgetAccountsError,
        repeatedAccounts,
      } = await insertAccounts({
        supabaseAdmin,
        parsedText,
        userId: user!.id,
        insertedInstitutions,
        budgetId,
      });

      if (budgetAccountsError || !data) {
        throw new CSVProcessingError('Failed to process accounts from CSV');
      }

      let insertedFinAccountTransactions: Database['public']['Tables']['fin_account_transactions']['Row'][] = [];
      const { accounts: insertedAccounts, budgetAccounts: insertedBudgetAccounts } = data as {
        accounts: Database['public']['Tables']['manual_fin_accounts']['Row'][];
        budgetAccounts: Database['public']['Tables']['budget_fin_accounts']['Row'][];
      };

      //We fetch the built in categories
      const { data: builtInCategories, error: builtInCategoriesError } =
        await supabase
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
        await supabase
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
          .eq('manual_fin_accounts.owner_account_id', user!.id);

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

      // First handle transaction merging for any matching manual accounts
      const validTransactions = newTransactions.filter(trans => {
        const matchingCategory = builtInCategories.find(
          (cat) =>
            normalizeCategory(cat.category_name ?? '') ===
            normalizeCategory(trans.TransactionCategory ?? '')
        );

        if (!matchingCategory) {
          console.warn(
            `Skipping transaction ${trans.TransactionId}: Invalid category "${trans.TransactionCategory}"`
          );
          return false;
        }
        return true;
      });

      // Process transactions regardless of budget account status
      if (validTransactions.length > 0) {
        const { data: insertedTxs, error: txError } = await supabaseAdmin
          .from('fin_account_transactions')
          .insert(
            validTransactions.map(trans => ({
              user_tx_id: trans.TransactionId,
              manual_account_id: insertedAccounts.find(
                acc => acc.name === trans.AccountName
              )?.id,
              amount: parseFloat(trans.TransactionAmount),
              date: trans.TransactionDate,
              svend_category_id: builtInCategories.find(
                cat => normalizeCategory(cat.category_name ?? '') === normalizeCategory(trans.TransactionCategory ?? '')
              )?.category_id || '',
              merchant_name: trans.TransactionMerchant || '',
              payee: '',
              meta_data:{
                created_for: budgetId  || ' '
              },
              tx_status: 'posted' as const,
              iso_currency_code: 'USD'
            }))
          )
          .select();

        if (txError) throw txError;
        insertedFinAccountTransactions = insertedTxs ?? [];
      }

      // Then separately handle the response with budget accounts if they exist
      const linkedFinAccounts = insertedAccounts.map(account => {
        const institution = insertedInstitutions.find(inst => inst.id === account.institution_id);
        if (!institution) {
          console.error('[CSV Processing] Could not find institution for account:', {
            accountId: account.id,
            institutionId: account.institution_id,
            availableInstitutions: insertedInstitutions.map(i => ({ id: i.id, name: i.name }))
          });
          return null;
        }

        // Budget account is optional now
        const budgetAccount = insertedBudgetAccounts.find(ba => ba.manual_account_id === account.id);

        return {
          id: account.id,
          source: 'svend' as const,
          institutionName: institution.name,
          budgetFinAccountId: budgetAccount?.id,
          name: account.name,
          mask: account.mask || '',
          officialName: account.name,
          balance: account.balance_current,
          meta_data: {
            created_for: budgetId
          }
        };
      }).filter((account): account is NonNullable<typeof account> => account !== null);

      // If we have no valid accounts, we should return an error
      if (linkedFinAccounts.length === 0) {
        return NextResponse.json({
          error: 'No valid accounts could be processed. This might be because the accounts in the CSV file don\'t match the existing accounts.'
        }, { status: 400 });
      }

      const parsedInstitutions = parseCSVResponse({
        insertedInstitutions,
        insertedAccounts,
        insertedBudgetAccounts,
        insertedFinAccountTransactions,
        supabase
      });

      // Before returning the response, calculate the summary
      const summary = {
        newInstitutions: insertedInstitutions.length - (repeatedInstitutions?.size || 0),
        newAccounts: insertedAccounts.length - (repeatedAccounts?.size || 0),
        newTransactions: insertedFinAccountTransactions?.length || 0
      };

      console.log('[CSV Processing] Summary:', summary);

      return NextResponse.json({ 
        institutions: parsedInstitutions,
        linkedFinAccounts,
        warning: linkedFinAccounts.length < insertedBudgetAccounts.length 
          ? 'Some accounts could not be processed because they don\'t match existing accounts.'
          : undefined,
        summary
      });
    } catch (error) {
      console.error('[CSV Processing] Error:', error);
      return NextResponse.json({
        error: 'Failed to process CSV file'
      }, {
        status: 500
      });
    }
  },
  {
    schema: requestSchema,
  }
);

export const normalizeCategory = (category: string): string => {
  return category
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
};

export class CSVProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CSVProcessingError';
  }
}
