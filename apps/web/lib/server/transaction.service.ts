import { Database } from '../database.types';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  BudgetFinAccountTransaction,
  BudgetFinAccountRecurringTransaction,
  BudgetFinAccountTransactionTag
} from '../model/budget.types';
import { FinAccountTransaction, Category, CategoryCompositionData, FinAccountRecurringTransaction } from '../model/fin.types';
import { PlaidApi, Transaction, TransactionStream } from 'plaid';
import { ICategoryService, createCategoryService } from './category.service';

/**
 * @name TransactionService
 * @description Service for transaction-related operations
 */
class TransactionService {
  private supabase: SupabaseClient<Database>;
  private categoryService: ICategoryService;

  constructor(
    supabaseClient: SupabaseClient
  ) {
    this.supabase = supabaseClient;
    this.categoryService = createCategoryService(supabaseClient);
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
  parseTransactions(raw: Database['public']['Tables']['fin_account_transactions']['Row'][]): FinAccountTransaction[] {
    try {
      if (!Array.isArray(raw)) {
        console.error('Expected array of transactions, received:', typeof raw);
        return [];
      }

      return raw.reduce((validTransactions: FinAccountTransaction[], transaction) => {
        try {
          // Validate required fields
          if (!transaction.id || !transaction.date || typeof transaction.amount !== 'number') {
            console.error('Missing required transaction fields:', transaction);
            return validTransactions;
          }

          // Validate date
          const transactionDate = new Date(transaction.date);
          if (isNaN(transactionDate.getTime())) {
            console.error('Invalid transaction date:', transaction.date);
            return validTransactions;
          }

          // Create validated transaction object matching database schema
          const validTransaction: FinAccountTransaction = {
            id: transaction.id,
            userTxId: transaction.user_tx_id,
            plaidTxId: transaction.plaid_tx_id || undefined,
            date: transaction.date,
            amount: transaction.amount,
            merchantName: transaction.merchant_name || '',
            payee: transaction.payee || '',
            isoCurrencyCode: transaction.iso_currency_code || undefined,
            manualAccountId: transaction.manual_account_id || undefined,
            plaidAccountId: transaction.plaid_account_id || undefined,
            svendCategoryId: transaction.svend_category_id || undefined,
            status: transaction.tx_status || 'posted',
            createdAt: transaction.created_at || undefined,
            updatedAt: transaction.updated_at || undefined
          };

          validTransactions.push(validTransaction);
          return validTransactions;

        } catch (error) {
          console.error('Error parsing individual transaction:', error);
          return validTransactions;
        }
      }, []);

    } catch (error) {
      console.error('Error parsing transactions:', error);
      return [];
    }
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
      // First, separate new transactions from updates based on plaid_tx_id
      const { data: existingTransactions, error: fetchError } = await this.supabase
        .from('fin_account_transactions')
        .select('id, plaid_tx_id')
        .in('plaid_tx_id', transactions.map(t => t.transaction.plaidTxId!));

      if (fetchError) throw fetchError;

      const existingTxMap = new Map(
        existingTransactions?.map(tx => [tx.plaid_tx_id, tx.id]) || []
      );

      const newTransactions = [];
      const updateTransactions = [];

      for (const tx of transactions) {
        if (existingTxMap.has(tx.transaction.plaidTxId!)) {
          updateTransactions.push({
            ...tx,
            transaction: {
              ...tx.transaction,
              id: existingTxMap.get(tx.transaction.plaidTxId!)!
            }
          });
        } else {
          newTransactions.push(tx);
        }
      }

      // Handle updates first
      if (updateTransactions.length > 0) {
        const { error: updateError } = await this.supabase
          .from('fin_account_transactions')
          .upsert(
            updateTransactions.map(tx => ({
              id: tx.transaction.id,
              plaid_tx_id: tx.transaction.plaidTxId || null,
              amount: tx.transaction.amount,
              date: tx.transaction.date,
              merchant_name: tx.transaction.merchantName || null,
              payee: tx.transaction.payee || null,
              tx_status: tx.transaction.status,
              svend_category_id: tx.category?.id!,
              user_tx_id: tx.transaction.userTxId!,
              iso_currency_code: tx.transaction.isoCurrencyCode || null,
              plaid_category_detailed: tx.transaction.plaidDetailedCategory || null,
              plaid_category_confidence: tx.transaction.plaidCategoryConfidence || null,
              plaid_raw_data: tx.transaction.plaidRawData as any
            }))
          );

        if (updateError) throw updateError;
      }

      // Handle new insertions using the stored procedure
      let newTransactionIds: string[] = [];
      if (newTransactions.length > 0) {
        const { data: ids, error: insertError } = await this.supabase
          .rpc('create_budget_fin_account_transactions', {
            p_budget_id: budgetId,
            p_transactions: newTransactions.map(tx => ({
              user_tx_id: tx.transaction.userTxId || null,
              plaid_tx_id: tx.transaction.plaidTxId || null,
              budget_fin_account_id: tx.budgetFinAccountId || null,
              amount: tx.transaction.amount,
              date: tx.transaction.date,
              svend_category_id: tx.category?.id || null,
              merchant_name: tx.transaction.merchantName || null,
              payee: tx.transaction.payee || null,
              tx_status: tx.transaction.status,
              iso_currency_code: tx.transaction.isoCurrencyCode || null,
              plaid_category_detailed: tx.transaction.plaidDetailedCategory || null,
              plaid_category_confidence: tx.transaction.plaidCategoryConfidence || null,
              plaid_raw_data: tx.transaction.plaidRawData as any
            }))
          });

        if (insertError) throw insertError;
        newTransactionIds = ids || [];
      }

      // Combine results
      const results = [
        ...updateTransactions,
        ...newTransactions.map((tx, index) => ({
          ...tx,
          transaction: {
            ...tx.transaction,
            id: newTransactionIds[index]!
          }
        }))
      ];

      return { data: results, error: null };
    } catch (error: any) {
      console.error('Error in saveBudgetTransactions:', error);
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
        svend_category_id: budgetTransaction.transaction.svendCategoryId!,
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
      // Get existing transactions by plaidTxId
      const { data: existingTransactions, error: fetchError } = await this.supabase
        .from('fin_account_transactions')
        .select('id, plaid_tx_id, user_tx_id')
        .in('plaid_tx_id', transactions.map(t => t.plaidTxId));

      if (fetchError) throw fetchError;

      const existingTxMap = new Map(
        existingTransactions?.map(tx => [tx.plaid_tx_id, tx]) || []
      );

      // Transform transactions into the expected input format
      const transactionsToUpsert = transactions.map(tx => {
        const existing = existingTxMap.get(tx.plaidTxId!);
        
        return {
          id: existing?.id,
          plaid_account_id: tx.plaidAccountId,
          user_tx_id: existing?.user_tx_id || tx.userTxId,
          plaid_tx_id: tx.plaidTxId,
          amount: tx.amount,
          date: tx.date,
          svend_category_id: tx.svendCategoryId as string,
          merchant_name: tx.merchantName || '',
          payee: tx.payee || '',
          tx_status: tx.status,
          iso_currency_code: tx.isoCurrencyCode || 'USD',
          plaid_category_detailed: tx.plaidDetailedCategory ?? null,
          plaid_category_confidence: tx.plaidCategoryConfidence ?? null,
          plaid_raw_data: tx.plaidRawData as any
        };
      });

      // Upsert transactions and return the IDs
      const { data: savedTransactions, error } = await this.supabase
        .from('fin_account_transactions')
        .upsert(transactionsToUpsert, {
          onConflict: 'plaid_tx_id',
          ignoreDuplicates: false
        })
        .select('id, user_tx_id, plaid_tx_id');

      // Log the results
      console.log('[TransactionService] Save/merge unlinked completed:', {
        total: transactions.length,
        new: transactions.length - (existingTransactions?.length || 0),
        updated: existingTransactions?.length || 0
      });

      if (error) {
        console.error('Error inserting transactions:', error);
        return { data: null, error: `Failed to persist transactions: ${error.message}` };
      }

      // Update the original transactions with the new IDs
      const savedTransactionsMap = new Map(
        savedTransactions?.map(tx => [tx.plaid_tx_id, tx]) || []
      );

      const mergedTransactions = transactions.map(transaction => ({
        ...transaction,
        id: savedTransactionsMap.get(transaction.plaidTxId!)?.id!,
        userTxId: savedTransactionsMap.get(transaction.plaidTxId!)?.user_tx_id || transaction.userTxId
      }));

      return { data: mergedTransactions, error: null };
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

  async syncPlaidTransactions(budgetId: string, plaidConnectionItems: PlaidConnectionItemSummary[], plaidClient: PlaidApi): Promise<ServiceResult<PlaidSyncTransactionsResponse>> {
    try {
      const newTransactions: BudgetFinAccountTransaction[] = [];
      const recurringTransactions: BudgetFinAccountRecurringTransaction[] = [];
      const newUnlinkedTransactions: FinAccountTransaction[] = [];
      const recurringUnlinkedTransactions: FinAccountRecurringTransaction[] = [];
      const itemCursors: Record<string, string> = {};
      const plaidIdUpdates = new Map<string, string>();
      const modifiedTransactions: BudgetFinAccountTransaction[] = [];

      // Process each Plaid connection
      for (const item of plaidConnectionItems) {
        let nextCursor = item.nextCursor;
        let hasMore = true;

        // Collect all transactions before saving
        while (hasMore) {
          const syncResponse = await plaidClient.transactionsSync({
            access_token: item.accessToken,
            cursor: nextCursor,
          });

          // Log transaction changes summary
          const pendingToPostedMap = new Map(
            (syncResponse.data.added || [])
              .filter(tx => tx.pending_transaction_id)
              .map(tx => [tx.pending_transaction_id, tx])
          );

          const added = new Set(syncResponse.data.added?.map(tx => tx.transaction_id) || []);
          const removed = new Set(syncResponse.data.removed?.map(tx => tx.transaction_id) || []);
          const modified = new Set(syncResponse.data.modified?.map(tx => tx.transaction_id) || []);
          const updates = new Set([...added].filter(id => removed.has(id)));

          // Create array of pending→posted transitions for logging
          const pendingToPostedTransitions = (syncResponse.data.removed || [])
            .map(removed => {
              const postedVersion = pendingToPostedMap.get(removed.transaction_id);
              return postedVersion ? {
                removedId: removed.transaction_id,
                newPostedId: postedVersion.transaction_id,
                amount: postedVersion.amount,
                date: postedVersion.date
              } : null;
            })
            .filter(Boolean);

          console.log('[TransactionService] Plaid sync batch:', {
            added: added.size,
            removed: removed.size,
            modified: modified.size,
            pendingToPosted: pendingToPostedTransitions.length,
            transitions: pendingToPostedTransitions,
            cursor: nextCursor
          });

          // Track all transaction changes in this sync
          const allTransactionChanges = new Map<string, {
            transaction: any,
            status: 'added' | 'modified' | 'removed'
          }>();

          // Process removed transactions first
          (syncResponse.data.removed || []).forEach(async (removed) => {
            const postedVersion = pendingToPostedMap.get(removed.transaction_id);
            if (postedVersion) {
              plaidIdUpdates.set(removed.transaction_id, postedVersion.transaction_id);
              // Update existing transaction with new plaid_tx_id and status
              const { error } = await this.supabase
                .from('fin_account_transactions')
                .update({ 
                  plaid_tx_id: postedVersion.transaction_id,
                  plaid_raw_data: postedVersion as any,
                  tx_status: 'posted'
                })
                .eq('plaid_tx_id', removed.transaction_id);
              
              if (error) {
                console.error('Failed to update pending→posted transaction:', {
                  oldId: removed.transaction_id,
                  newId: postedVersion.transaction_id,
                  error
                });
              }
            }
          });

          // Skip adding transactions that are posted versions of pending ones we're updating
          (syncResponse.data.added || []).forEach(added => {
            if (!added.pending_transaction_id || !plaidIdUpdates.has(added.pending_transaction_id)) {
              allTransactionChanges.set(added.transaction_id, {
                transaction: added,
                status: 'added'
              });
            }
          });

          // After processing added transactions, add this:
          (syncResponse.data.modified || []).forEach(modified => {
            allTransactionChanges.set(modified.transaction_id, {
              transaction: modified,
              status: 'modified'
            });
          });

          // Then update the filter condition to include modified transactions:
          const transactionsToProcess = Array.from(allTransactionChanges.values())
            .filter(change => 
              // Process both additions and modifications that have categories
              (change.status === 'added' || change.status === 'modified') && 
              change.transaction.personal_finance_category?.detailed
            )
            .map(change => change.transaction);

          const processedTransactions = await this.processPlaidTransactions(
            transactionsToProcess,
            item.plaidAccounts
          );

          // Handle the processed transactions
          for (const transaction of processedTransactions) {
            if (transaction.budgetFinAccountId) {
              const changeType = allTransactionChanges.get(transaction.transaction.plaidTxId!)?.status;
              if (changeType === 'modified') {
                modifiedTransactions.push(transaction);
              } else {
                newTransactions.push(transaction);
              }
            } else {
              newUnlinkedTransactions.push(transaction.transaction);
            }
          }

          hasMore = syncResponse.data.has_more;
          nextCursor = syncResponse.data.next_cursor;
        }

        // Save all transactions first
        if (newTransactions.length > 0) {
          const { error: saveError } = await this.saveBudgetTransactions(newTransactions, budgetId);
          if (saveError) return { data: null, error: saveError };
        }

        if (newUnlinkedTransactions.length > 0) {
          const { error: saveUnlinkedError } = await this.saveTransactions(newUnlinkedTransactions);
          if (saveUnlinkedError) return { data: null, error: saveUnlinkedError };
        }

        // Only update cursor after successful save
        const { error: cursorError } = await this.updatePlaidItemCursor(item.svendItemId, nextCursor);
        if (cursorError) return { data: null, error: cursorError };

        itemCursors[item.svendItemId] = nextCursor;
      }

      return {
        data: {
          budgetId,
          newTransactions,
          newUnlinkedTransactions,
          recurringTransactions,
          recurringUnlinkedTransactions,
          modifiedTransactions
        },
        error: null
      };

    } catch (error: any) {
      console.error('Error in syncPlaidTransactions:', error);
      return { data: null, error: `Failed to sync transactions: ${error.message}` };
    }
  }

  private async processPlaidTransactions(
    plaidTransactions: Transaction[],
    plaidAccounts: any[]
  ): Promise<BudgetFinAccountTransaction[]> {
    try {
      // 1. Initial transaction creation
      const transactions = await Promise.all(plaidTransactions.map(async transaction => {
        // Validate required fields
        if (!transaction.transaction_id || !transaction.account_id || !transaction.date) {
          console.warn('Missing required Plaid transaction fields:', transaction);
          return null;
        }

        const matchingAccount = plaidAccounts?.find(
          account => account.plaid_account_id === transaction.account_id
        );

        if (!matchingAccount) {
          console.warn('No matching account found for transaction:', transaction.transaction_id);
          return null;
        }

        const rawAmount = transaction.amount;
        const amount = Math.round(rawAmount * 100) / 100;

        console.log('[TransactionService] Processing transaction:', {
          id: transaction.transaction_id,
          rawAmount,
          processedAmount: amount,
          date: transaction.date,
          category: transaction.personal_finance_category?.detailed,
          status: transaction.pending ? 'pending' : 'posted'
        });

        // Create base transaction
        const baseTransaction: BudgetFinAccountTransaction = {
          transaction: {
            id: '',
            plaidTxId: transaction.transaction_id,
            userTxId: '', // Will be generated
            date: transaction.date,
            amount,
            plaidDetailedCategory: transaction.personal_finance_category?.detailed || undefined,
            plaidCategoryConfidence: transaction.personal_finance_category?.confidence_level || undefined,
            plaidAccountId: matchingAccount.id,
            merchantName: transaction.merchant_name ?? '',
            payee: transaction.payment_meta?.payee ?? '',
            status: transaction.pending ? 'pending' : 'posted',
            isoCurrencyCode: transaction.iso_currency_code ?? 'USD',
            plaidRawData: transaction,
          },
          budgetFinAccountId: matchingAccount.budget_fin_account_id,
          categoryGroupId: '',
          categoryGroup: '',
          category: {} as Category,
          merchantName: transaction.merchant_name ?? '',
          payee: transaction.payment_meta?.payee ?? '',
          notes: '',
          budgetTags: [],
          budgetAttachmentsStorageNames: []
        };

        // Generate unique userTxId for the transaction
        baseTransaction.transaction.userTxId = await this.generateUserTxIdFromPlaidTx(baseTransaction.transaction);

        return baseTransaction;
      }));

      const validTransactions = transactions.filter((tx): tx is BudgetFinAccountTransaction => tx !== null);

      // 2. Process categories
      const { transactions: processedTransactions, error } = await this.processPlaidCategories(validTransactions, []);
      if (error) {
        console.error('Error processing categories:', error);
        return validTransactions; // Return unprocessed transactions as fallback
      }

      // 3. Sort transactions by date (newest first)
      return (processedTransactions || validTransactions).sort((a, b) => 
        new Date(b.transaction.date).getTime() - new Date(a.transaction.date).getTime()
      );
    } catch (error) {
      console.error('Error processing Plaid transactions:', error);
      return [];
    }
  }

  private async generateUserTxIdFromPlaidTx(transaction: FinAccountTransaction): Promise<string> {
    let isUnique = false;
    let uniqueId: string | undefined;

    const generateId = (tx: FinAccountTransaction): string => {
      const date = new Date(tx.date);
      const formattedDate = date.toISOString().slice(0, 10).replace(/-/g, '');
      const plaidTxIdSuffix = tx.plaidTxId?.slice(-6) || '000000';
      const randomCounter = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
      return `P${formattedDate}${randomCounter}${plaidTxIdSuffix}`;
    };

    while (!isUnique) {
      const potentialIds = Array.from({ length: 10 }, () => generateId(transaction));

      const { data: existingTxs } = await this.supabase
        .from('fin_account_transactions')
        .select('user_tx_id')
        .in('user_tx_id', potentialIds);

      const existingIds = new Set(existingTxs?.map(tx => tx.user_tx_id));
      uniqueId = potentialIds.find(id => !existingIds.has(id));

      if (uniqueId) {
        isUnique = true;
      }
    }

    return uniqueId!;
  }

  private async processPlaidRecurringTransactions(
    plaidStreams: TransactionStream[],
    plaidAccounts: any[]
  ): Promise<BudgetFinAccountRecurringTransaction[]> {
    try {
      // Get ALL plaid transaction IDs from ALL streams
      const allPlaidTxIds = plaidStreams.flatMap(stream => stream.transaction_ids || []);
      
      // Query for ALL corresponding fin_account_transactions, both new and existing
      const { data: finAccountTxs, error: queryError } = await this.supabase
        .from('fin_account_transactions')
        .select('id, plaid_tx_id')
        .in('plaid_tx_id', allPlaidTxIds);

      if (queryError) {
        console.error('Error fetching fin_account_transactions:', queryError);
        return [];
      }

      // Create mapping of plaid_tx_id -> our internal id
      const txIdMap = new Map(
        finAccountTxs?.map(tx => [tx.plaid_tx_id, tx.id]) || []
      );

      const recurringTransactions = await Promise.all(plaidStreams.map(async stream => {
        // Validate required fields
        if (!stream.stream_id || !stream.account_id) {
          console.warn('Missing required Plaid stream fields:', stream);
          return null;
        }

        const matchingAccount = plaidAccounts?.find(
          account => account.plaid_account_id === stream.account_id
        );

        if (!matchingAccount) {
          console.warn('No matching account found for stream:', stream.stream_id);
          return null;
        }

        // Map ALL referenced transaction IDs (both new and existing)
        const finAccountIds = (stream.transaction_ids || [])
          .map(plaidId => txIdMap.get(plaidId))
          .filter((id): id is string => id !== undefined);

        const tx = {
          transaction: {
            id: '',
            plaidTxId: stream.stream_id,
            userTxId: '', // Will be generated
            plaidAccountId: matchingAccount.id,
            plaidDetailedCategory: stream.personal_finance_category?.detailed || undefined,
            plaidCategoryConfidence: stream.personal_finance_category?.confidence_level || undefined,
            plaidTransactionIds: stream.transaction_ids || [],
            finAccountTransactionIds: finAccountIds,
            plaidRawData: stream
          },
          budgetFinAccountId: matchingAccount.budget_fin_account_id,
          notes: '',
          budgetTags: []
        };

        // Generate unique user transaction ID
        tx.transaction.userTxId = await this.generateUserTxIdFromRecurringPlaidTx(tx.transaction);

        return tx;
      }));

      const validTransactions = recurringTransactions.filter((tx) => tx !== null);

      // Process categories
      const { recurringTransactions: processedTransactions, error } = 
        await this.processPlaidCategories([], validTransactions);
      
      if (error) {
        console.error('Error processing recurring transaction categories:', error);
        return validTransactions;
      }

      return processedTransactions || validTransactions;
    } catch (error) {
      console.error('Error processing Plaid recurring transactions:', error);
      return [];
    }
  }

  private async generateUserTxIdFromRecurringPlaidTx(transaction: FinAccountRecurringTransaction): Promise<string> {
    let isUnique = false;
    let uniqueId: string | undefined;

    // Get most recent date from plaid data
    const getMostRecentDate = (tx: FinAccountRecurringTransaction): Date => {
      const lastDate = tx.plaidRawData?.last_date;
      return lastDate ? new Date(lastDate) : new Date();
    };

    const mostRecentDate = getMostRecentDate(transaction);
    const formattedDate = mostRecentDate.toISOString().slice(0, 10).replace(/-/g, '');
    const plaidTxIdSuffix = transaction.plaidTxId?.slice(-6) || '000000';

    while (!isUnique) {
      const potentialIds = Array.from({ length: 10 }, () => {
        const randomCounter = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
        return `P${formattedDate}${randomCounter}${plaidTxIdSuffix}`;
      });

      const { data: existingTxs } = await this.supabase
        .from('fin_account_recurring_transactions')
        .select('user_tx_id')
        .in('user_tx_id', potentialIds);

      const existingIds = new Set(existingTxs?.map(tx => tx.user_tx_id));
      uniqueId = potentialIds.find(id => !existingIds.has(id));

      if (uniqueId) {
        isUnique = true;
      }
    }

    return uniqueId!;
  }

  private async processPlaidCategories(
    transactions: BudgetFinAccountTransaction[],
    recurringTransactions: BudgetFinAccountRecurringTransaction[]
  ): Promise<{ 
    transactions?: BudgetFinAccountTransaction[], 
    recurringTransactions?: BudgetFinAccountRecurringTransaction[],
    error?: string 
  }> {
    try {
      // Get unique Plaid categories from both transaction types
      const uniquePlaidCategories = [...new Set([
        ...transactions.map(t => t.transaction.plaidDetailedCategory),
        ...recurringTransactions.map(t => t.transaction.plaidDetailedCategory)
      ].filter((cat): cat is string => !!cat))];

      // Get mappings and categories
      const [plaidMappings, svendCategories] = await Promise.all([
        this.categoryService.mapPlaidCategoriesToSvendCategories(uniquePlaidCategories),
        this.categoryService.getSvendDefaultCategoryGroups()
      ]);

      if (!plaidMappings || !svendCategories) {
        throw new Error('Category mapping or categories fetch returned null or undefined');
      }

      // Helper function to find category by Plaid category name
      const findCategoryByPlaidCategory = (plaidCategory: string) => {
        const mappedName = plaidMappings[plaidCategory]?.name;
        if (!mappedName) return null;

        const group = Object.values(svendCategories).find(group =>
          group.categories.some(cat => cat.name === mappedName)
        );
        if (!group) return null;

        const category = group.categories.find(cat => cat.name === mappedName);
        if (!category) return null;

        return { category, groupName: group.name, groupId: group.id };
      };

      // Process regular transactions
      const processedTransactions = transactions.map(transaction => {
        const plaidCategory = transaction.transaction.plaidDetailedCategory;
        if (!plaidCategory) return transaction;

        const mappedCategory = findCategoryByPlaidCategory(plaidCategory);
        if (!mappedCategory) return transaction;

        return {
          ...transaction,
          category: {
            ...mappedCategory.category,
            isDiscretionary: mappedCategory.category.isDiscretionary,
            createdAt: mappedCategory.category.createdAt,
            updatedAt: mappedCategory.category.updatedAt,
          },
          categoryGroup: mappedCategory.groupName,
          categoryGroupId: mappedCategory.groupId
        };
      });

      // Process recurring transactions
      const processedRecurringTransactions = recurringTransactions.map(tx => {
        const plaidCategory = tx.transaction.plaidDetailedCategory;
        if (!plaidCategory) return tx;

        const mappedCategory = findCategoryByPlaidCategory(plaidCategory);
        if (!mappedCategory) return tx;

        return {
          ...tx,
          categoryId: mappedCategory.category.id,
          category: mappedCategory.category.name,
          categoryGroup: mappedCategory.groupName,
          categoryGroupId: mappedCategory.groupId
        };
      });

      return { 
        transactions: processedTransactions, 
        recurringTransactions: processedRecurringTransactions 
      };
    } catch (error: any) {
      console.error('Error in processCategories:', error);
      return { error: `SERVER_ERROR:[processPlaidCategories] ${error.message}` };
    }
  }

  async syncPlaidTransactionsByTeamAccountSlug(
    teamAccountSlug: string,
    plaidClient: PlaidApi
  ): Promise<ServiceResult<PlaidSyncTransactionsResponse>> {
    console.log(`[TransactionService] Starting Plaid sync for team account: ${teamAccountSlug} ...`);
    try {
      // First get the budget and its plaid items
      const { data: plaidItems, error: plaidItemsError } = await this.supabase
        .rpc('get_budget_plaid_items', { 
          p_team_account_slug: teamAccountSlug 
        });

      console.log('[TransactionService] Plaid items fetch:', {
        itemsCount: plaidItems?.length || 0,
        error: plaidItemsError || null
      });

      if (plaidItemsError) throw plaidItemsError;
      if (!plaidItems?.length) {
        return { 
          data: {
            budgetId: plaidItems[0]?.budget_id || '',
            newTransactions: [],
            newUnlinkedTransactions: [],
            recurringTransactions: [],
            recurringUnlinkedTransactions: [],
            modifiedTransactions: []
          },
          error: null 
        };
      }

      // Map plaid items to the format expected by syncPlaidTransactions
      const plaidConnectionItems: PlaidConnectionItemSummary[] = plaidItems.map(item => ({
        svendItemId: item.id,
        accessToken: item.access_token,
        nextCursor: item.next_cursor || '',
        plaidAccounts: Array.isArray(item.plaid_accounts) ? item.plaid_accounts : []
      }));

      // We already checked plaidItems.length above, so first item exists
      const { data, error } = await this.syncPlaidTransactions(
        plaidItems[0]!.budget_id,
        plaidConnectionItems, 
        plaidClient
      );

      return { data, error };

    } catch (error: any) {
      console.error('[TransactionService] Sync error:', error);
      return { data: null, error: `Failed to sync transactions: ${error.message}` };
    }
  }

  private async updatePlaidItemCursor(itemId: string, cursor: string): Promise<ServiceResult<null>> {
    const { error } = await this.supabase
      .from('plaid_connection_items')
      .update({ next_cursor: cursor })
      .eq('id', itemId);

    if (error) {
      console.error('Error updating cursor:', error);
      return { data: null, error: 'Failed to update cursor' };
    }

    return { data: null, error: null };
  }

  private async mergeBudgetFinAccountRecurringTransaction(
    newTransactions: BudgetFinAccountRecurringTransaction[],
    budgetId: string
  ): Promise<ServiceResult<null>> {
    try {
      // Get existing transactions by plaidTxId
      const { data: existingTransactions, error: fetchError } = await this.supabase
        .from('fin_account_recurring_transactions')
        .select(`
          id,
          plaid_tx_id,
          fin_account_transaction_ids,
          plaid_raw_data,
          updated_at
        `)
        .in('plaid_tx_id', newTransactions.map(t => t.transaction.plaidTxId));

      if (fetchError) throw fetchError;

      // Update existing transactions with new data
      for (const newTx of newTransactions) {
        const existing = existingTransactions?.find(
          et => et.plaid_tx_id === newTx.transaction.plaidTxId
        );

        if (existing) {
          const { error: updateError } = await this.supabase
            .from('fin_account_recurring_transactions')
            .update({
              fin_account_transaction_ids: newTx.transaction.finAccountTransactionIds,
              plaid_raw_data: newTx.transaction.plaidRawData as any
              // updated_at will be set by trigger_set_timestamps()
            })
            .eq('id', existing.id);

          if (updateError) throw updateError;
        } else {
          const insertData = {
            plaid_tx_id: newTx.transaction.plaidTxId!,
            user_tx_id: newTx.transaction.userTxId!,
            plaid_account_id: newTx.transaction.plaidAccountId!,
            svend_category_id: newTx.transaction.svendCategoryId || null,
            plaid_category_detailed: newTx.transaction.plaidDetailedCategory || null,
            plaid_category_confidence: newTx.transaction.plaidCategoryConfidence || null,
            plaid_transaction_ids: newTx.transaction.finAccountTransactionIds || [],
            fin_account_transaction_ids: newTx.transaction.finAccountTransactionIds || [],
            plaid_raw_data: newTx.transaction.plaidRawData as any
          };

          const { error: insertError } = await this.supabase
            .from('fin_account_recurring_transactions')
            .insert([insertData as any]);

          if (insertError) throw insertError;
        }
      }
      
      return { data: null, error: null };
    } catch (error: any) {
      console.error('Error merging recurring transactions:', error);
      return { data: null, error: error.message };
    }
  }

  private async mergeFinAccountRecurringTransactions(
    newTransactions: FinAccountRecurringTransaction[]
  ): Promise<ServiceResult<null>> {
    try {
      // Get existing transactions by plaidTxId
      const { data: existingTransactions, error: fetchError } = await this.supabase
        .from('fin_account_recurring_transactions')
        .select('*')
        .in('plaid_tx_id', newTransactions.map(t => t.plaidTxId));

      if (fetchError) throw fetchError;

      // Update existing transactions with new data
      for (const newTx of newTransactions) {
        const existing = existingTransactions?.find(et => et.plaid_tx_id === newTx.plaidTxId);

        if (existing) {
          const { error: updateError } = await this.supabase
            .from('fin_account_recurring_transactions')
            .update({
              fin_account_transaction_ids: newTx.finAccountTransactionIds,
              plaid_raw_data: newTx.plaidRawData as any,
              // updated_at will be set by trigger_set_timestamps()
            })
            .eq('id', existing.id);

          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await this.supabase
            .from('fin_account_recurring_transactions')
            .insert([newTx as any]);

          if (insertError) throw insertError;
        }
      }

      return { data: null, error: null };
    } catch (error: any) {
      console.error('Error merging unlinked recurring transactions:', error);
      return { data: null, error: error.message };
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
  parseTransactions: (
    raw: Database['public']['Tables']['fin_account_transactions']['Row'][]
  ) => FinAccountTransaction[];
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
  syncPlaidTransactions: (
    budgetId: string,
    plaidConnectionItems: PlaidConnectionItemSummary[],
    plaidClient: PlaidApi
  ) => Promise<ServiceResult<PlaidSyncTransactionsResponse>>;
  syncPlaidTransactionsByTeamAccountSlug: (
    teamAccountSlug: string,
    plaidClient: PlaidApi
  ) => Promise<ServiceResult<PlaidSyncTransactionsResponse>>;
}

export type ServiceResult<T> = {
  data: T | null;
  error: string | null;
};

export type PlaidConnectionItemSummary = {
  svendItemId: string;
  accessToken: string;
  nextCursor: string;
  plaidAccounts: any[];
};

export interface PlaidSyncTransactionsResponse {
  budgetId: string;
  newTransactions: BudgetFinAccountTransaction[];
  newUnlinkedTransactions: FinAccountTransaction[];
  recurringTransactions: BudgetFinAccountRecurringTransaction[];
  recurringUnlinkedTransactions: FinAccountRecurringTransaction[];
  modifiedTransactions: BudgetFinAccountTransaction[];
}
