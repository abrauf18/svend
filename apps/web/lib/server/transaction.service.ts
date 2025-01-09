import { Database } from '../database.types';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  BudgetFinAccountTransaction,
  BudgetFinAccountRecurringTransaction,
  BudgetFinAccountTransactionTag
} from '../model/budget.types';
import { FinAccountTransaction, CategoryCompositionData, FinAccountRecurringTransaction } from '../model/fin.types';

/**
 * @name TransactionService
 * @description Service for transaction-related operations
 */
class TransactionService {
  private supabase: SupabaseClient<Database>;

  constructor(
    supabaseClient: SupabaseClient
  ) {
    this.supabase = supabaseClient;
  }

  /**
 * Parses and validates raw budget transactions into strongly typed FinAccountTransaction objects
 * @param raw The raw budget transactions from the get_budget_transactions_by_team_account_slug function
 * @returns Array of validated FinAccountTransaction objects
 * 
 * Maps the following fields from database:
 * - Basic: id, date, amount, merchantName, payee, isoCurrencyCode
 * - Categories: plaidDetailedCategoryName, svendCategoryGroup, svendCategoryName, svendCategoryId
 * - Budget: budgetFinAccountId, notes
 * - Arrays: budgetTags (tags), budgetAttachmentsStorageNames (attachments_storage_names)
 */
  parseBudgetTransactions(raw: Database['public']['Functions']['get_budget_transactions_by_team_account_slug']['Returns']): BudgetFinAccountTransaction[] {
    try {
      if (!Array.isArray(raw)) {
        console.error('Expected array of transactions, received:', typeof raw);
        return [];
      }

      return raw.reduce((validTransactions: BudgetFinAccountTransaction[], budgetTransaction) => {
        try {
          // Validate required fields
          if (!budgetTransaction.id || !budgetTransaction.date ||
            typeof budgetTransaction.amount !== 'number' ||
            !budgetTransaction.budget_fin_account_id) {
            console.error('Missing required transaction fields:', budgetTransaction);
            return validTransactions;
          }

          // Validate date
          const transactionDate = new Date(budgetTransaction.date);
          if (isNaN(transactionDate.getTime())) {
            console.error('Invalid transaction date:', budgetTransaction.date);
            return validTransactions;
          }

          // Create validated transaction object matching SQL function return values
          const validTransaction: BudgetFinAccountTransaction = {
            transaction: {
              id: budgetTransaction.id,
              userTxId: budgetTransaction.user_tx_id,
              plaidTxId: budgetTransaction.plaid_tx_id,
              date: budgetTransaction.date,
              amount: budgetTransaction.amount,
              merchantName: budgetTransaction.merchant_name,
              payee: budgetTransaction.payee ?? undefined,
              isoCurrencyCode: budgetTransaction.iso_currency_code ?? undefined,
            } as FinAccountTransaction,
            budgetFinAccountId: budgetTransaction.budget_fin_account_id ?? undefined,

            // Category information
            categoryGroupId: budgetTransaction.svend_category_group_id ?? undefined,
            categoryGroup: budgetTransaction.svend_category_group ?? undefined,
            category: {
              id: budgetTransaction.svend_category_id ?? undefined,
              name: budgetTransaction.svend_category ?? undefined,
              isComposite: budgetTransaction.is_composite ?? false,
              compositeData: Array.isArray(budgetTransaction.composite_data)
                ? (budgetTransaction.composite_data as unknown as CategoryCompositionData[])
                : undefined,
            } as any,

            // Optional fields that match SQL return
            merchantName: budgetTransaction.merchant_name ?? undefined,
            payee: budgetTransaction.payee ?? undefined,
            notes: budgetTransaction.notes ?? '',

            // Arrays from SQL
            budgetTags: (budgetTransaction.tags as any[] ?? []).map((tag: any) => ({
              id: tag.id || tag,  // Handle both object and string formats
              name: tag.name || tag
            } as BudgetFinAccountTransactionTag)),
            budgetAttachmentsStorageNames: budgetTransaction.attachments_storage_names ?? [],
          };

          validTransactions.push(validTransaction);
          return validTransactions;

        } catch (error) {
          console.error('Error parsing individual transaction:', error);
          return validTransactions;
        }
      }, []);

    } catch (error) {
      console.error('Error parsing budget transactions:', error);
      return [];
    }
  }

  /**
   * Parses and validates raw budget recurring transactions into strongly typed BudgetFinAccountRecurringTransaction objects
   * @param raw The raw budget recurring transactions from the get_budget_recurring_transactions_by_team_account_slug function
   * @returns Array of validated BudgetFinAccountRecurringTransaction objects
   * 
   * Maps the following fields from database:
   * - Basic: id
   * - Categories: plaidDetailedCategoryName, svendCategoryGroup, svendCategoryName, svendCategoryId
   * - Budget: budgetFinAccountId, notes
   * - Arrays: budgetTags (tags)
   */
  parseBudgetRecurringTransactions(raw: Database['public']['Functions']['get_budget_recurring_transactions_by_team_account_slug']['Returns']): BudgetFinAccountRecurringTransaction[] {
    try {
      if (!Array.isArray(raw)) {
        console.error('Expected array of transactions, received:', typeof raw);
        return [];
      }

      return raw.reduce((validTransactions: BudgetFinAccountRecurringTransaction[], budgetRecurringTransaction) => {
        try {
          // Validate required fields
          if (!budgetRecurringTransaction.id) {
            console.error('Missing required transaction fields:', budgetRecurringTransaction);
            return validTransactions;
          }

          // Create validated transaction object matching SQL function return values
          const validTransaction: BudgetFinAccountRecurringTransaction = {
            transaction: {
              id: budgetRecurringTransaction.id,
              userTxId: budgetRecurringTransaction.user_tx_id,
              plaidTxId: budgetRecurringTransaction.plaid_tx_id,
              finAccountTransactionIds: budgetRecurringTransaction.fin_account_transaction_ids ?? [],
              createdAt: budgetRecurringTransaction.created_at,
              updatedAt: budgetRecurringTransaction.updated_at,
              plaidRawData: budgetRecurringTransaction.plaid_raw_data as any ?? undefined,
            },
            budgetFinAccountId: budgetRecurringTransaction.budget_fin_account_id ?? undefined,

            // Category information
            categoryGroupId: budgetRecurringTransaction.svend_category_group_id ?? undefined,
            categoryGroup: budgetRecurringTransaction.svend_category_group ?? undefined,
            categoryId: budgetRecurringTransaction.svend_category_id ?? undefined,
            category: budgetRecurringTransaction.svend_category ?? undefined,

            // Optional fields that match SQL return
            notes: budgetRecurringTransaction.notes ?? '',

            // Arrays from SQL
            budgetTags: (budgetRecurringTransaction.tags as any[] ?? []).map((tag: any) => ({
              id: tag.id || tag,  // Handle both object and string formats
              name: tag.name || tag
            } as BudgetFinAccountTransactionTag)),
          };

          validTransactions.push(validTransaction);
          return validTransactions;

        } catch (error) {
          console.error('Error parsing individual transaction:', error);
          return validTransactions;
        }
      }, []);

    } catch (error) {
      console.error('Error parsing budget transactions:', error);
      return [];
    }
  }


  /**
   * @name saveBudgetTransactions
   * @description Saves budget transactions to the database
   */
  async saveBudgetTransactions(transactions: BudgetFinAccountTransaction[], budgetId: string): Promise<ServiceResult<BudgetFinAccountTransaction[]>> {
    try {
      // Transform transactions into the expected input format
      const transactionInputs = transactions.map(budgetTransaction => ({
        budget_fin_account_id: budgetTransaction.budgetFinAccountId!,
        user_tx_id: budgetTransaction.transaction.userTxId,
        plaid_tx_id: budgetTransaction.transaction.plaidTxId ?? null,
        amount: budgetTransaction.transaction.amount,
        date: budgetTransaction.transaction.date,
        svend_category_id: budgetTransaction.category?.id,
        merchant_name: budgetTransaction.transaction.merchantName || '',
        payee: budgetTransaction.transaction.payee || '',
        iso_currency_code: budgetTransaction.transaction.isoCurrencyCode || 'USD',
        plaid_category_detailed: budgetTransaction.transaction.plaidDetailedCategory ?? null,
        plaid_category_confidence: budgetTransaction.transaction.plaidCategoryConfidence ?? null,
        plaid_raw_data: budgetTransaction.transaction.plaidRawData as any
      }));

      // Call the RPC function with the array of inputs
      const { data: transactionIds, error } = await this.supabase
        .rpc('create_budget_fin_account_transactions', {
          p_budget_id: budgetId,
          p_transactions: transactionInputs
        });

      if (error) {
        console.error(`Error inserting transactions:`, error);
        return { data: null, error: `Failed to persist transactions: ${error.message}` };
      }

      // Update the original transactions with the new IDs
      const savedTransactions = transactions.map((transaction, index) => ({
        ...transaction,
        transaction: {
          ...transaction.transaction,
          id: transactionIds[index]!
        }
      }));

      return { data: savedTransactions, error: null };
    } catch (error: any) {
      console.error('Error in persistTransactions:', error);
      return { data: null, error: `Failed to persist transactions: ${error.message}` };
    }
  }

  /**
   * @name saveBudgetRecurringTransactions
   * @description Saves budget recurring transactions to the database
   */
  async saveBudgetRecurringTransactions(transactions: BudgetFinAccountRecurringTransaction[], budgetId: string): Promise<ServiceResult<BudgetFinAccountRecurringTransaction[]>> {
    try {
      // Transform transactions into the expected input format
      const transactionInputs = transactions.map(budgetTransaction => ({
        budget_fin_account_id: budgetTransaction.budgetFinAccountId!,
        user_tx_id: budgetTransaction.transaction.userTxId,
        plaid_tx_id: budgetTransaction.transaction.plaidTxId ?? null,
        fin_account_transaction_ids: budgetTransaction.transaction.finAccountTransactionIds,
        svend_category_id: budgetTransaction.categoryId!,
        plaid_category_detailed: budgetTransaction.transaction.plaidDetailedCategory ?? null,
        plaid_category_confidence: budgetTransaction.transaction.plaidCategoryConfidence ?? null,
        plaid_raw_data: budgetTransaction.transaction.plaidRawData as any
      }));

      // Call the RPC function with the array of inputs
      const { data: transactionIds, error } = await this.supabase
        .rpc('create_budget_fin_account_recurring_transactions', {
          p_budget_id: budgetId,
          p_transactions: transactionInputs
        });

      if (error) {
        console.error(`Error inserting recurring transactions:`, error);
        // Debug log
        console.error('Failed transactions params:', {
          budgetId,
          transactionCount: transactions.length,
          firstTransaction: transactionInputs[0]
        });
        return { data: null, error: `Failed to persist recurring transactions: ${error.message}` };
      }

      // Verify we got back the expected number of IDs
      if (transactionIds.length !== transactions.length) {
        console.warn(
          'Mismatch in returned recurring transaction IDs:',
          {
            expectedCount: transactions.length,
            returnedCount: transactionIds.length
          }
        );
      }

      // Update the original transactions with the new IDs
      const savedTransactions = transactions.map((transaction, index) => ({
        ...transaction,
        transaction: {
          ...transaction.transaction,
          id: transactionIds[index]!
        }
      }));

      return { data: savedTransactions, error: null }; // success
    } catch (error: any) {
      console.error('Error in persistRecurringTransactions:', error);
      return { data: null, error: `Failed to persist recurring transactions: ${error.message}` };
    }
  }

  /**
   * @name saveTransactions
   * @description Saves transactions to the database, useful when adding a transaction to a fin account not associated with any budget
   */
  async saveTransactions(transactions: FinAccountTransaction[]): Promise<ServiceResult<FinAccountTransaction[]>> {
    try {
      // Transform transactions into the expected input format
      const transactionsToInsert = transactions.map(tx => ({
        plaid_account_id: tx.plaidAccountId,
        user_tx_id: tx.userTxId,
        plaid_tx_id: tx.plaidTxId,
        amount: tx.amount,
        date: tx.date,
        svend_category_id: tx.svendCategoryId as string,
        merchant_name: tx.merchantName || '',
        payee: tx.payee || '',
        iso_currency_code: tx.isoCurrencyCode || 'USD',
        plaid_category_detailed: tx.plaidDetailedCategory ?? null,
        plaid_category_confidence: tx.plaidCategoryConfidence ?? null,
        plaid_raw_data: tx.plaidRawData as any
      }));

      // Insert transactions and return the IDs
      const { data: transactionIds, error } = await this.supabase
        .from('fin_account_transactions')
        .insert(transactionsToInsert)
        .select('id');

      if (error) {
        console.error('Error inserting transactions:', error);
        return { data: null, error: `Failed to persist transactions: ${error.message}` };
      }

      // Update the original transactions with the new IDs
      const savedTransactions = transactions.map((transaction, index) => ({
        ...transaction,
        id: transactionIds[index]!.id
      }));

      return { data: savedTransactions, error: null };
    } catch (error: any) {
      console.error('Error in persistTransactions:', error);
      return { data: null, error: `Failed to persist transactions: ${error.message}` };
    }
  }

  /**
   * @name saveRecurringTransactions
   * @description Saves recurring transactions to the database, useful when adding a recurring transaction to a fin account not associated with any budget
   */
  async saveRecurringTransactions(transactions: FinAccountRecurringTransaction[]): Promise<ServiceResult<FinAccountRecurringTransaction[]>> {
    const BATCH_SIZE = 100;

    try {
      for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const batch = transactions.slice(i, i + BATCH_SIZE);
        const transactionsToInsert = batch.map((tx) => ({
          user_tx_id: tx.userTxId,
          plaid_tx_id: tx.plaidTxId,
          fin_account_transaction_ids: tx.finAccountTransactionIds,
          svend_category_id: tx.svendCategoryId as string,
          plaid_account_id: tx.plaidAccountId,
          plaid_category_detailed: tx.plaidDetailedCategory,
          plaid_category_confidence: tx.plaidCategoryConfidence,
          plaid_raw_data: tx.plaidRawData as any
        }));

        const { error } = await this.supabase
          .from('fin_account_recurring_transactions')
          .insert(transactionsToInsert);

        if (error) {
          console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, error);
          return { data: null, error: `Failed to persist transactions batch ${i / BATCH_SIZE + 1}: ${error.message}` };
        }

        // Add a small delay between batches to prevent overwhelming the database
        if (i + BATCH_SIZE < transactions.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      return { data: null, error: null }; // success
    } catch (error: any) {
      console.error('Error in persistTransactions:', error);
      return { data: null, error: `Failed to persist transactions: ${error.message}` };
    }
  }
}

/**
 * Creates an instance of the SpendingService.
 * @param supabaseClient - The Supabase client instance
 * @returns An instance of SpendingService.
 */
export function createTransactionService(
  supabaseClient: SupabaseClient
): ITransactionService {
  return new TransactionService(supabaseClient);
}

export interface ITransactionService {
  parseBudgetTransactions: (
    raw: Database['public']['Functions']['get_budget_transactions_by_team_account_slug']['Returns']
  ) => BudgetFinAccountTransaction[];
  parseBudgetRecurringTransactions: (
    raw: Database['public']['Functions']['get_budget_recurring_transactions_by_team_account_slug']['Returns']
  ) => BudgetFinAccountRecurringTransaction[];
  saveBudgetTransactions: (transactions: BudgetFinAccountTransaction[], budgetId: string) => Promise<ServiceResult<BudgetFinAccountTransaction[]>>;
  saveBudgetRecurringTransactions: (transactions: BudgetFinAccountRecurringTransaction[], budgetId: string) => Promise<ServiceResult<BudgetFinAccountRecurringTransaction[]>>;
  saveTransactions: (transactions: FinAccountTransaction[]) => Promise<ServiceResult<FinAccountTransaction[]>>;
  saveRecurringTransactions: (transactions: FinAccountRecurringTransaction[]) => Promise<ServiceResult<FinAccountRecurringTransaction[]>>;
}

export type ServiceResult<T> = {
  data: T | null;
  error: string | null;
};
