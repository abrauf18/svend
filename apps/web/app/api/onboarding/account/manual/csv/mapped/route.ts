import { enhanceRouteHandler } from '@kit/next/routes';
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { z } from 'zod';
import papa from 'papaparse';

// Handlers
import insertInstitutions from '../_handlers/insert-institutions';
import insertAccounts from '../_handlers/insert-accounts';

// Utilities
import {
  CSVProcessingError,
  normalizeCategory,
} from '../route';
import { parseCSVResponse } from '../_utils/parse-csv-response';
import checkCSVValidity from '~/lib/utils/check-csv-validity';

// Types
import { CSVRow, CSV_VALID_COLUMNS } from '~/lib/model/onboarding.types';
import { Database } from '~/lib/database.types';

const postSchema = z.object({
  filename: z.string(),
  columnMappings: z.array(
    z.object({
      internalColumn: z.enum(CSV_VALID_COLUMNS),
      csvColumn: z.string()
    })
  )
});

// POST /api/onboarding/account/manual/csv/mapped
// Insert the mapped CSV data into the database
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

    try {
      const { filename, columnMappings } = body;

      // 1. Download and parse the original CSV
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('onboarding_attachments')
        .download(filename);

      if (downloadError) {
        return NextResponse.json(
          { error: 'Failed to download CSV file. Please try uploading again.' },
          { status: 400 }
        );
      }

      if (!fileData) {
        return NextResponse.json(
          { error: 'No file data received' },
          { status: 400 }
        );
      }

      const text = await fileData.text();
      const { data: rawCsvData } = papa.parse<Record<string, string>>(text, { header: true });

      // Check what columns are missing from the original CSV
      const validProps = Object.fromEntries(
        CSV_VALID_COLUMNS.map(key => [key, true])
      );

      const { isValid, missingProps, mappableProps, invalidRows: validityInvalidRows, error: csvValidityError } = checkCSVValidity({
        csv: rawCsvData as CSVRow[],
        csvValidProps: validProps as Record<keyof CSVRow, boolean>
      });

      // Validate that all missing columns are mapped
      const mappedColumns = columnMappings.map(m => m.internalColumn);
      const unmappedRequiredColumns = (missingProps || []).filter(col =>
        !mappedColumns.includes(col as typeof CSV_VALID_COLUMNS[number])
      );

      if (unmappedRequiredColumns.length > 0) {
        return NextResponse.json({
          error: `Missing mappings for required columns: ${unmappedRequiredColumns.join(', ')}`,
          unmappedColumns: unmappedRequiredColumns
        }, {
          status: 400
        });
      }

      // Apply the mappings to transform the CSV data
      const transformedData = rawCsvData.map(row => {
        // Start with all matching column names from original data
        const newRow: Partial<CSVRow> = {};
        Object.entries(row).forEach(([key, value]) => {
          if (CSV_VALID_COLUMNS.includes(key as keyof CSVRow)) {
            newRow[key as keyof CSVRow] = value;
          }
        });

        // Then apply any specific mappings
        columnMappings.forEach(mapping => {
          if (mapping.csvColumn === 'auto-generate') {
            if (mapping.internalColumn === 'TransactionId') {
              newRow[mapping.internalColumn] = generateTransactionIdFromCSV({
                bankSymbol: row.BankSymbol || '',
                bankMask: row.Mask || '',
                index: 0
              });
            }
          } else {
            newRow[mapping.internalColumn] = row[mapping.csvColumn] || '';
          }
        });

        return newRow as CSVRow;
      });

      // Now validate the transformed data
      const { isValid: isValidTransformed, invalidRows, error: validationError } = checkCSVValidity({
        csv: transformedData,
        csvValidProps: validProps as Record<keyof CSVRow, boolean>
      });

      if (!isValidTransformed) {
        return NextResponse.json({
          error: 'Transformed CSV validation failed',
          details: validationError?.message,
          invalidRows
        }, {
          status: 400
        });
      }

      const supabaseAdmin = getSupabaseServerAdminClient();
      const { data: insertedInstitutions, error: institutionsError, repeatedInstitutions } =
        await insertInstitutions({
          supabaseAdmin,
          parsedText: transformedData,
          userId: user.id,
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

      const { data, error: budgetAccountsError, repeatedAccounts } = await insertAccounts({
        supabaseAdmin,
        parsedText: transformedData,
        userId: user.id,
        insertedInstitutions,
        budgetId,
      });

      if (budgetAccountsError || !data) {
        throw new CSVProcessingError('Failed to process accounts from CSV');
      }

      const { accounts: insertedAccounts, budgetAccounts: insertedBudgetAccounts } = data as {
        accounts: Database['public']['Tables']['manual_fin_accounts']['Row'][];
        budgetAccounts: Database['public']['Tables']['budget_fin_accounts']['Row'][];
      };

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
          const transactionsRows = transformedData.filter(
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
            normalizeCategory(trans.TransactionCategory ?? ''),
        );

        if (!matchingCategory) {
          console.warn(
            `Skipping transaction ${trans.TransactionId}: Invalid category "${trans.TransactionCategory}". Available categories:`,
            builtInCategories.map((c) => c.category_name),
          );
          return false;
        }
        return true;
      });

      // First process transactions for any matching manual accounts
      if (validTransactions.length > 0) {
        let insertedFinAccountTransactions: Database['public']['Tables']['fin_account_transactions']['Row'][] = [];
        const { data: insertedTxs, error: insertError } = await supabaseAdmin
          .from('fin_account_transactions')
          .insert(validTransactions.map(trans => ({
            user_tx_id: trans.TransactionId,
            manual_account_id: insertedAccounts.find(acc => acc.name === trans.AccountName)?.id,
            date: trans.TransactionDate,
            amount: parseFloat(trans.TransactionAmount),
            merchant_name: trans.TransactionMerchant || '',
            payee: '',
            iso_currency_code: 'USD',
            tx_status: 'posted' as const,
            meta_data:{
              created_for: budgetId  || ' '
            },
            svend_category_id: builtInCategories.find(
              cat => normalizeCategory(cat.category_name ?? '') === normalizeCategory(trans.TransactionCategory ?? '')
            )?.category_id || ''
          })))
          .select('*');

        if (insertError) throw insertError;
        insertedFinAccountTransactions = insertedTxs ?? [];

        const summary = {
          newInstitutions: insertedInstitutions.length - (repeatedInstitutions?.size || 0),
          newAccounts: insertedAccounts.length - (repeatedAccounts?.size || 0),
          newTransactions: insertedFinAccountTransactions.length
        };

        const parsedInstitutions = parseCSVResponse({
          insertedInstitutions,
          insertedAccounts,
          insertedBudgetAccounts,
          insertedFinAccountTransactions,
          supabase
        });

        return NextResponse.json({ 
          institutions: parsedInstitutions,
          summary 
        });
      }

      return NextResponse.json({ 
        institutions: [],
        summary: { newInstitutions: 0, newAccounts: 0, newTransactions: 0 }
      });
    } catch (err: any) {
      console.error('[Mapped CSV Processing] Unexpected error:', {
        error: err,
        message: err.message,
        details: err.details,
        stack: err.stack,
      });

      return NextResponse.json(
        {
          error: 'Unknown error',
        },
        { status: 500 },
      );
    }
  },
  { schema: postSchema },
);

function generateTransactionIdFromCSV({
  bankSymbol,
  bankMask,
  index,
}: {
  bankSymbol: string;
  bankMask: string;
  index: number;
}): string | undefined {
  try {
    let currentNum = index;
    const randomNum = String(currentNum).padStart(8, '0');
    return `${bankSymbol}${bankMask}${randomNum}`;
  } catch (err: any) {
    console.error(err);
    return undefined;
  }
}
