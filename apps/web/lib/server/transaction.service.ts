import { Database } from '../database.types';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  BudgetFinAccountTransaction,
  BudgetFinAccountRecurringTransaction,
  BudgetFinAccountTransactionTag
} from '../model/budget.types';
import { FinAccountTransaction, Category, CategoryCompositionData, FinAccountRecurringTransaction, FinAccount } from '../model/fin.types';
import { PlaidApi, Transaction, TransactionsEnrichRequest, TransactionStream, EnrichTransactionDirection, ClientProvidedEnrichedTransaction, TransactionStreamStatus } from 'plaid';
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
 * @param raw The raw budget transactions from the fin_account_transactions table
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
              status: budgetTransaction.tx_status ?? 'posted',
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
      // First, handle enrichment updates for manual transactions
      const manualTransactionsToEnrich = transactions.filter(tx => 
        tx.transaction.manualAccountId && 
        (tx.transaction.plaidDetailedCategory || tx.transaction.plaidCategoryConfidence || tx.transaction.plaidRawData)
      );

      if (manualTransactionsToEnrich.length > 0) {
        const updateData = manualTransactionsToEnrich
          .filter(tx => tx.transaction.id)
          .map(tx => {
            const updateFields: any = { 
              id: tx.transaction.id,
              date: tx.transaction.date,
              amount: tx.transaction.amount,
              svend_category_id: tx.transaction.svendCategoryId,
              user_tx_id: tx.transaction.userTxId
            };
            if (tx.transaction.plaidDetailedCategory) updateFields.plaid_category_detailed = tx.transaction.plaidDetailedCategory;
            if (tx.transaction.plaidCategoryConfidence) updateFields.plaid_category_confidence = tx.transaction.plaidCategoryConfidence;
            if (tx.transaction.plaidRawData) updateFields.plaid_raw_data = tx.transaction.plaidRawData;
            return updateFields;
          });

        if (updateData.length > 0) {
          const { error: updateError } = await this.supabase
            .from('fin_account_transactions')
            .upsert(updateData);

          if (updateError) throw updateError;
        }
      }

      // Continue with existing logic for new transactions via RPC
      const plaidTxIds = transactions
        .filter(t => t.transaction.plaidTxId)
        .map(t => t.transaction.plaidTxId!);
      
      const manualTxIds = transactions
        .filter(t => t.transaction.manualAccountId)
        .map(t => t.transaction.id)
        .filter(Boolean);

      // Query for existing transactions
      const { data: existingTransactions, error: fetchError } = await this.supabase
        .from('fin_account_transactions')
        .select('id, plaid_tx_id, manual_account_id')
        .or(`plaid_tx_id.in.(${plaidTxIds.map(id => `"${id}"`).join(',')}),id.in.(${manualTxIds.map(id => `"${id}"`).join(',')})`);

      if (fetchError) throw fetchError;

      // Create maps for both Plaid and manual transactions
      const existingPlaidTxMap = new Map(
        existingTransactions?.filter(tx => tx.plaid_tx_id).map(tx => [tx.plaid_tx_id, tx.id]) || []
      );
      const existingManualTxMap = new Map(
        existingTransactions?.filter(tx => !tx.plaid_tx_id).map(tx => [tx.id, tx.id]) || []
      );

      const newTransactions = [];
      const updateTransactions = [];

      for (const tx of transactions) {
        if (tx.transaction.plaidTxId && existingPlaidTxMap.has(tx.transaction.plaidTxId)) {
          updateTransactions.push({
            ...tx,
            transaction: {
              ...tx.transaction,
              id: existingPlaidTxMap.get(tx.transaction.plaidTxId)!
            }
          });
        } else if (tx.transaction.manualAccountId && existingManualTxMap.has(tx.transaction.id)) {
          updateTransactions.push(tx);
        } else {
          newTransactions.push(tx);
        }
      }

      // Handle new insertions using the stored procedure
      let newTransactionIds: string[] = [];
      if (newTransactions.length > 0) {
        const rpcPayload = newTransactions.map(tx => ({
          user_tx_id: tx.transaction.userTxId || null,
          plaid_tx_id: tx.transaction.plaidTxId || null,
          manual_account_id: tx.transaction.manualAccountId || null,
          budget_fin_account_id: tx.budgetFinAccountId || null,
          amount: tx.transaction.amount,
          date: tx.transaction.date,
          svend_category_id: tx.category?.id,
          merchant_name: tx.transaction.merchantName || null,
          payee: tx.transaction.payee || null,
          tx_status: tx.transaction.status,
          iso_currency_code: tx.transaction.isoCurrencyCode || null,
          plaid_category_detailed: tx.transaction.plaidDetailedCategory ?? null,
          plaid_category_confidence: tx.transaction.plaidCategoryConfidence ?? null,
          plaid_raw_data: tx.transaction.plaidRawData as any
        }));

        const { data: ids, error: insertError } = await this.supabase
          .rpc('create_budget_fin_account_transactions', {
            p_budget_id: budgetId,
            p_transactions: rpcPayload
          });

        if (insertError) {
          console.error('[Debug] RPC error:', insertError);
          throw insertError;
        }
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
        budget_fin_account_id: budgetTransaction.budgetFinAccountId,
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
      // Get existing transactions by both plaidTxId and userTxId
      const { data: existingTransactions, error } = await this.supabase
        .from('fin_account_transactions')
        .select('id, plaid_tx_id, user_tx_id')
        .or(`plaid_tx_id.in.(${transactions.map(t => t.plaidTxId ? `"${t.plaidTxId}"` : 'null').join(',')}),user_tx_id.in.(${transactions.map(t => t.userTxId ? `"${t.userTxId}"` : 'null').join(',')})`);

      if (error) throw error;

      // Create maps for both Plaid and user transactions
      const existingPlaidTxMap = new Map(
        existingTransactions?.filter(tx => tx.plaid_tx_id).map(tx => [tx.plaid_tx_id, tx]) || []
      );
      const existingUserTxMap = new Map(
        existingTransactions?.filter(tx => tx.user_tx_id).map(tx => [tx.user_tx_id, tx]) || []
      );

      const newTransactions = [];
      const updateTransactions = [];

      // Separate new from existing transactions
      for (const tx of transactions) {
        const existingByPlaid = tx.plaidTxId ? existingPlaidTxMap.get(tx.plaidTxId) : null;
        const existingByUser = tx.userTxId ? existingUserTxMap.get(tx.userTxId) : null;
        const existing = existingByPlaid || existingByUser;

        const txData = {
          id: existing?.id || crypto.randomUUID(),
          plaid_account_id: tx.plaidAccountId,
          manual_account_id: tx.manualAccountId,
          user_tx_id: existing?.user_tx_id || tx.userTxId,
          plaid_tx_id: tx.plaidTxId,
          amount: tx.amount,
          date: tx.date,
          svend_category_id: tx.svendCategoryId!,
          merchant_name: tx.merchantName || '',
          payee: tx.payee || '',
          tx_status: tx.status,
          iso_currency_code: tx.isoCurrencyCode || 'USD',
          plaid_category_detailed: tx.plaidDetailedCategory ?? null,
          plaid_category_confidence: tx.plaidCategoryConfidence ?? null,
          plaid_raw_data: tx.plaidRawData as any
        };

        if (existing) {
          updateTransactions.push(txData);
        } else {
          newTransactions.push(txData);
        }
      }

      // Handle all updates in a single upsert
      if (updateTransactions.length > 0) {
        const { error: upsertError } = await this.supabase
          .from('fin_account_transactions')
          .upsert(updateTransactions);

        if (upsertError) throw upsertError;
      }

      // Handle all new inserts in a single call
      if (newTransactions.length > 0) {
        const { error: insertError } = await this.supabase
          .from('fin_account_transactions')
          .insert(newTransactions);

        if (insertError) {
          console.error('[Debug] Insert error details:', {
            error: insertError,
            failingTransaction: newTransactions.find(tx => 
              !tx.svend_category_id || tx.svend_category_id === null
            )
          });
          throw insertError;
        }
      }

      // Get all saved transactions
      const { data: savedTransactions, error: selectError } = await this.supabase
        .from('fin_account_transactions')
        .select('id, user_tx_id, plaid_tx_id')
        .in('id', [...updateTransactions, ...newTransactions].map(tx => tx.id));

      if (selectError) throw selectError;

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
      // Check for existing transactions first
      const userTxIds = transactions.map(tx => tx.userTxId).filter(Boolean);
      const { data: existingTxs, error: queryError } = await this.supabase
        .from('fin_account_recurring_transactions')
        .select('user_tx_id')
        .in('user_tx_id', userTxIds);

      if (queryError) return { data: null, error: queryError.message };

      // Filter out existing transactions
      const existingTxIds = new Set(existingTxs?.map(tx => tx.user_tx_id));
      const newTransactions = transactions.filter(tx => !existingTxIds.has(tx.userTxId));

      // Process batches of new transactions only
      for (let i = 0; i < newTransactions.length; i += BATCH_SIZE) {
        const batch = newTransactions.slice(i, i + BATCH_SIZE);
        console.log('[Debug] Raw transactions before mapping:', batch.map(tx => ({
          userTxId: tx.userTxId,
          finAccountTransactionIds: tx.finAccountTransactionIds,
          rawTx: tx  // Add this to see the full object
        })));

        const transactionsToInsert = batch.map((tx) => ({
          user_tx_id: tx.userTxId,
          plaid_tx_id: tx.plaidTxId,
          fin_account_transaction_ids: tx.finAccountTransactionIds,
          svend_category_id: tx.svendCategoryId as string,
          plaid_account_id: tx.plaidAccountId,
          manual_account_id: tx.manualAccountId,
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
        if (i + BATCH_SIZE < newTransactions.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      return { data: null, error: null }; // success
    } catch (error: any) {
      console.error('Error in persistTransactions:', error);
      return { data: null, error: `Failed to persist transactions: ${error.message}` };
    }
  }

  async syncPlaidTransactions(
    plaidConnectionItems: PlaidConnectionItemSummary[],
    plaidClient: PlaidApi
  ): Promise<ServiceResult<PlaidSyncTransactionsResponse>> {
    try {
      const newTransactions: BudgetFinAccountTransaction[] = [];
      const newUnlinkedTransactions: FinAccountTransaction[] = [];  // Single array for unlinked
      const recurringTransactions: BudgetFinAccountRecurringTransaction[] = [];
      const recurringUnlinkedTransactions: FinAccountRecurringTransaction[] = [];
      const itemCursors: Record<string, string> = {};
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

          // Track all transaction changes in this sync
          const allTransactionChanges = new Map<string, {
            transaction: any,
            status: 'added' | 'modified' | 'removed'
          }>();

          // Process removed transactions first
          (syncResponse.data.removed || []).forEach(async (removed) => {
            const postedVersion = pendingToPostedMap.get(removed.transaction_id);
            if (postedVersion) {
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
            if (!added.pending_transaction_id || !allTransactionChanges.has(added.transaction_id)) {
              allTransactionChanges.set(added.transaction_id, {
                transaction: added,
                status: 'added'
              });
            }
          });

          // Process modified transactions
          (syncResponse.data.modified || []).forEach(modified => {
            allTransactionChanges.set(modified.transaction_id, {
              transaction: modified,
              status: 'modified'
            });
          });

          // Filter and process transactions
          const transactionsToProcess = Array.from(allTransactionChanges.values())
            .filter(change => 
              (change.status === 'added' || change.status === 'modified') && 
              change.transaction.personal_finance_category?.detailed
            )
            .map(change => change.transaction);

          // Add initial log for transactions being processed
          console.log('Processing batch of transactions:', {
            batchSize: transactionsToProcess.length,
            sampleTransaction: transactionsToProcess[0] ? {
              id: transactionsToProcess[0].transaction_id,
              accountId: transactionsToProcess[0].account_id,
              amount: transactionsToProcess[0].amount
            } : null
          });

          // Handle unlinked transactions first
          const unlinkedTransactionsToProcess = [];
          for (const transaction of transactionsToProcess) {
            const matchingAccount = item.plaidAccounts.find(acc => 
              acc.plaidAccountId === transaction.account_id
            );

            if (!matchingAccount || !matchingAccount.budgetFinAccountIds?.length) {
              const unlinkedTx: FinAccountTransaction = {
                id: '',
                plaidTxId: transaction.transaction_id,
                userTxId: await this.generateUserTxIdFromPlaidTx({
                  id: '',
                  plaidTxId: transaction.transaction_id,
                  date: transaction.date,
                  amount: transaction.amount,
                  plaidAccountId: matchingAccount?.svendAccountId // Use svendAccountId here
                } as FinAccountTransaction),
                date: transaction.date,
                amount: Math.round(transaction.amount * 100) / 100,
                plaidDetailedCategory: transaction.personal_finance_category?.detailed,
                plaidCategoryConfidence: transaction.personal_finance_category?.confidence_level,
                plaidAccountId: matchingAccount?.svendAccountId, // Use svendAccountId here
                merchantName: transaction.merchant_name ?? '',
                payee: transaction.payment_meta?.payee ?? '',
                status: transaction.pending ? 'pending' : 'posted',
                isoCurrencyCode: transaction.iso_currency_code ?? 'USD',
                plaidRawData: transaction,
              };
              unlinkedTransactionsToProcess.push(unlinkedTx);
              console.log('Adding unlinked transaction:', {
                plaidAccountId: unlinkedTx.plaidAccountId,
                plaidTxId: unlinkedTx.plaidTxId,
                amount: unlinkedTx.amount,
                reason: !matchingAccount ? 'no_matching_account' : 'no_budget_links'
              });
            }
          }

          // Process unlinked transactions with their own category processor
          if (unlinkedTransactionsToProcess.length > 0) {
            console.log('Processing categories for unlinked transactions:', {
              count: unlinkedTransactionsToProcess.length,
              sample: unlinkedTransactionsToProcess[0]
            });

            const { transactions: processedUnlinkedTransactions, error: unlinkedError } = 
              await this.processPlaidCategoriesUnlinked(unlinkedTransactionsToProcess, []);
            
            if (unlinkedError) {
              console.error('Error processing unlinked transaction categories:', unlinkedError);
              return { data: null, error: unlinkedError };  // Return early if category processing fails
            } 
            
            if (processedUnlinkedTransactions) {
              // Verify categories were assigned
              const missingCategories = processedUnlinkedTransactions.filter(tx => !tx.svendCategoryId);
              if (missingCategories.length > 0) {
                console.error('Some transactions still missing categories after processing:', {
                  count: missingCategories.length,
                  sample: missingCategories[0]
                });
                return { data: null, error: 'Failed to assign categories to some transactions' };
              }

              console.log('Successfully processed unlinked transactions:', {
                count: processedUnlinkedTransactions.length,
                sample: {
                  plaidTxId: processedUnlinkedTransactions[0]?.plaidTxId,
                  category: processedUnlinkedTransactions[0]?.svendCategoryId
                }
              });

              newUnlinkedTransactions.push(...processedUnlinkedTransactions);
            }
          }

          // Filter out unlinked transactions before processing linked ones
          const linkedTransactionsToProcess = transactionsToProcess.filter(transaction => {
            const matchingAccount = item.plaidAccounts.find(acc => 
              acc.plaidAccountId === transaction.account_id
            );
            return matchingAccount && matchingAccount.budgetFinAccountIds?.length > 0;
          });

          // Process linked transactions
          const processedTransactions = await this.processPlaidTransactions(
            linkedTransactionsToProcess,
            item.plaidAccounts
          );

          // Add log after processing
          console.log('Processed transactions:', {
            processedCount: processedTransactions.length,
            sampleProcessed: processedTransactions[0] ? {
              plaidAccountId: processedTransactions[0].transaction.plaidAccountId,
              budgetFinAccountId: processedTransactions[0].budgetFinAccountId
            } : null
          });

          // Handle the processed transactions
          for (const transaction of processedTransactions) {
            const account = item.plaidAccounts.find(acc => 
              acc.svendAccountId === transaction.transaction.plaidAccountId
            );

            if (!account || !account.budgetFinAccountIds || account.budgetFinAccountIds.length === 0) {
              continue; // Skip any transactions that somehow got through without proper account links
            }

            // Add log for linked transactions
            console.log('Processing linked transaction:', {
              plaidTxId: transaction.transaction.plaidTxId,
              budgetFinAccountId: transaction.budgetFinAccountId,
              changeType: allTransactionChanges.get(transaction.transaction.plaidTxId!)?.status
            });

            // Handle linked transactions
            if (transaction.budgetFinAccountId) {
              const changeType = allTransactionChanges.get(transaction.transaction.plaidTxId!)?.status;
              if (changeType === 'modified') {
                modifiedTransactions.push(transaction);
              } else {
                newTransactions.push(transaction);
              }
            }
          }

          hasMore = syncResponse.data.has_more;
          nextCursor = syncResponse.data.next_cursor;
        }

        // Group transactions by budget ID
        const transactionsByBudget = new Map<string, BudgetFinAccountTransaction[]>();
        
        // Group new transactions by budget
        for (const tx of newTransactions) {
          if (tx.budgetFinAccountId) {
            // Get the budget IDs from the plaidAccounts mapping
            const account = item.plaidAccounts.find(acc => 
              acc.svendAccountId === tx.transaction.plaidAccountId
            );
            if (account?.budgetFinAccountIds) {
              // For each budget_fin_account_id, create a copy of the transaction
              account.budgetFinAccountIds
                .filter((budgetFinAccountId): budgetFinAccountId is string => 
                  budgetFinAccountId !== null
                )
                .forEach(budgetFinAccountId => {
                  // Create a new transaction with this specific budgetFinAccountId
                  const txCopy = {
                    ...tx,
                    budgetFinAccountId
                  };

                  if (!transactionsByBudget.has(budgetFinAccountId)) {
                    transactionsByBudget.set(budgetFinAccountId, []);
                  }
                  transactionsByBudget.get(budgetFinAccountId)!.push(txCopy);
                });
            }
          }
        }

        // Get budget mappings
        const allBudgetFinAccountIds = Array.from(transactionsByBudget.keys());
        const { data: budgetFinAccounts, error: bfaError } = await this.supabase
          .from('budget_fin_accounts')
          .select('id, budget_id')
          .in('id', allBudgetFinAccountIds);

        if (bfaError) {
          console.error('Error fetching budget_fin_accounts:', bfaError);
          return { data: null, error: 'Failed to fetch budget mappings' };
        }

        // Create budget ID mapping
        const budgetIdMap = new Map(
          budgetFinAccounts?.map(bfa => [bfa.id, bfa.budget_id]) || []
        );

        // Save transactions by budget
        for (const [budgetFinAccountId, budgetTransactions] of transactionsByBudget.entries()) {
          const budgetId = budgetIdMap.get(budgetFinAccountId);
          if (!budgetId) {
            console.warn(`No budget_id found for budget_fin_account ${budgetFinAccountId}, skipping transactions`);
            continue;
          }

          if (budgetTransactions.length > 0) {
            const { error: saveError } = await this.saveBudgetTransactions(budgetTransactions, budgetId);
            if (saveError) {
              console.error(`Error saving transactions for budget ${budgetId}:`, saveError);
              continue;
            }
          }
        }

        // Update cursor after successful processing
        const { error: cursorError } = await this.updatePlaidItemCursor(item.svendItemId, nextCursor);
        if (cursorError) return { data: null, error: cursorError };

        itemCursors[item.svendItemId] = nextCursor;
      }

      // Log final processing summary
      console.log('Transaction processing summary:', {
        unlinkedCount: newUnlinkedTransactions.length,
        linkedCount: newTransactions.length,
        modifiedCount: modifiedTransactions.length
      });

      // Save all unlinked transactions at once
      if (newUnlinkedTransactions.length > 0) {
        console.log('Saving unlinked transactions:', {
          count: newUnlinkedTransactions.length,
          sample: newUnlinkedTransactions[0] ? {
            id: newUnlinkedTransactions[0].id,
            plaidTxId: newUnlinkedTransactions[0].plaidTxId,
            plaidAccountId: newUnlinkedTransactions[0].plaidAccountId,
            svendCategoryId: newUnlinkedTransactions[0].svendCategoryId
          } : null
        });

        const { error: saveUnlinkedError } = await this.saveTransactions(newUnlinkedTransactions);
        if (saveUnlinkedError) {
          console.error('Failed to save unlinked transactions:', {
            error: saveUnlinkedError,
            count: newUnlinkedTransactions.length
          });
          return { data: null, error: saveUnlinkedError };
        }
        console.log('Successfully saved unlinked transactions:', {
          count: newUnlinkedTransactions.length
        });
      }

      return {
        data: {
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

  async syncPlaidTransactionsFinAccountMgmt(
    plaidConnectionItems: PlaidConnectionItemSummary[],
    plaidClient: PlaidApi
  ): Promise<ServiceResult<PlaidSyncTransactionsResponse>> {
    try {
      const newTransactions: BudgetFinAccountTransaction[] = [];
      const newUnlinkedTransactions: FinAccountTransaction[] = [];
      const recurringTransactions: BudgetFinAccountRecurringTransaction[] = [];
      const recurringUnlinkedTransactions: FinAccountRecurringTransaction[] = [];
      const itemCursors: Record<string, string> = {};
      const modifiedTransactions: BudgetFinAccountTransaction[] = [];

      // Process each Plaid connection
      for (const item of plaidConnectionItems) {
        let nextCursor = item.nextCursor;
        let hasMore = true;

        // Collect all transactions before saving
        while (hasMore) {
          console.log('Plaid sync request:', {
            access_token: item.accessToken,
            cursor: nextCursor,
            item_id: item.svendItemId
          });

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

          // Track all transaction changes in this sync
          const allTransactionChanges = new Map<string, {
            transaction: any,
            status: 'added' | 'modified' | 'removed'
          }>();

          // Process removed transactions first
          (syncResponse.data.removed || []).forEach(async (removed) => {
            const postedVersion = pendingToPostedMap.get(removed.transaction_id);
            if (postedVersion) {
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
            if (!added.pending_transaction_id || !allTransactionChanges.has(added.transaction_id)) {
              allTransactionChanges.set(added.transaction_id, {
                transaction: added,
                status: 'added'
              });
            }
          });

          // Process modified transactions
          (syncResponse.data.modified || []).forEach(modified => {
            allTransactionChanges.set(modified.transaction_id, {
              transaction: modified,
              status: 'modified'
            });
          });

          // Filter and process transactions
          const transactionsToProcess = Array.from(allTransactionChanges.values())
            .filter(change => 
              (change.status === 'added' || change.status === 'modified') && 
              change.transaction.personal_finance_category?.detailed
            )
            .map(change => change.transaction);

          // Add initial log for transactions being processed
          console.log('Processing transactions:', {
            total: transactionsToProcess.length,
            sample: transactionsToProcess[0] ? {
              id: transactionsToProcess[0].transaction_id,
              account: transactionsToProcess[0].account_id,
              amount: transactionsToProcess[0].amount
            } : null
          });

          // Handle unlinked transactions first
          const unlinkedTransactionsToProcess = [];
          for (const transaction of transactionsToProcess) {
            const matchingAccount = item.plaidAccounts.find(acc => 
              acc.plaidAccountId === transaction.account_id
            );

            if (matchingAccount) {
              const unlinkedTx: FinAccountTransaction = {
                id: '',
                plaidTxId: transaction.transaction_id,
                userTxId: await this.generateUserTxIdFromPlaidTx({
                  id: '',
                  plaidTxId: transaction.transaction_id,
                  date: transaction.date,
                  amount: transaction.amount,
                  plaidAccountId: matchingAccount.svendAccountId
                } as FinAccountTransaction),
                date: transaction.date,
                amount: Math.round(transaction.amount * 100) / 100,
                plaidDetailedCategory: transaction.personal_finance_category?.detailed,
                plaidCategoryConfidence: transaction.personal_finance_category?.confidence_level,
                plaidAccountId: matchingAccount.svendAccountId,
                merchantName: transaction.merchant_name ?? '',
                payee: transaction.payment_meta?.payee ?? '',
                status: transaction.pending ? 'pending' : 'posted',
                isoCurrencyCode: transaction.iso_currency_code ?? 'USD',
                plaidRawData: transaction,
              };
              unlinkedTransactionsToProcess.push(unlinkedTx);
            }
          }

          // Process and save unlinked transactions
          if (unlinkedTransactionsToProcess.length > 0) {
            const { transactions: processedUnlinkedTransactions, error: unlinkedError } = 
              await this.processPlaidCategoriesUnlinked(unlinkedTransactionsToProcess, []);
            
            if (unlinkedError) {
              console.error('Error processing unlinked transaction categories:', unlinkedError);
              return { data: null, error: unlinkedError };
            } 
            
            if (processedUnlinkedTransactions) {
              newUnlinkedTransactions.push(...processedUnlinkedTransactions);
            }
          }

          hasMore = syncResponse.data.has_more;
          nextCursor = syncResponse.data.next_cursor;
        }

        // Update cursor after successful processing
        const { error: cursorError } = await this.updatePlaidItemCursor(item.svendItemId, nextCursor);
        if (cursorError) return { data: null, error: cursorError };

        itemCursors[item.svendItemId] = nextCursor;
      }

      // Log final processing summary
      console.log('Transaction processing summary:', {
        unlinkedCount: newUnlinkedTransactions.length,
        linkedCount: newTransactions.length,
        modifiedCount: modifiedTransactions.length
      });

      // Save all unlinked transactions at once
      if (newUnlinkedTransactions.length > 0) {
        console.log('Saving unlinked transactions:', {
          count: newUnlinkedTransactions.length,
          sample: newUnlinkedTransactions[0] ? {
            id: newUnlinkedTransactions[0].id,
            plaidTxId: newUnlinkedTransactions[0].plaidTxId,
            plaidAccountId: newUnlinkedTransactions[0].plaidAccountId,
            svendCategoryId: newUnlinkedTransactions[0].svendCategoryId
          } : null
        });

        const { error: saveUnlinkedError } = await this.saveTransactions(newUnlinkedTransactions);
        if (saveUnlinkedError) {
          console.error('Failed to save unlinked transactions:', {
            error: saveUnlinkedError,
            count: newUnlinkedTransactions.length
          });
          return { data: null, error: saveUnlinkedError };
        }
        console.log('Successfully saved unlinked transactions:', {
          count: newUnlinkedTransactions.length
        });
      }

      return {
        data: {
          newTransactions,
          newUnlinkedTransactions,
          recurringTransactions,
          recurringUnlinkedTransactions,
          modifiedTransactions
        },
        error: null
      };

    } catch (error: any) {
      console.error('Error in syncPlaidTransactionsFinAccountMgmt:', error);
      return { data: null, error: `Failed to sync transactions: ${error.message}` };
    }
  }

  private async processPlaidTransactions(
    plaidTransactions: Transaction[],
    plaidAccounts: PlaidConnectionItemAccountSummary[]
  ): Promise<BudgetFinAccountTransaction[]> {
    try {
        // Add initial log
        console.log('Starting processPlaidTransactions:', {
            inputTransactions: plaidTransactions.length,
            accounts: plaidAccounts.map(acc => ({
                svendAccountId: acc.svendAccountId,
                plaidAccountId: acc.plaidAccountId,
                budgetLinks: acc.budgetFinAccountIds.length
            }))
        });

        // Log transactions that are being filtered out due to missing required fields
        plaidTransactions.forEach(transaction => {
            if (!transaction.transaction_id || !transaction.account_id || !transaction.date) {
                console.log('Skipping transaction - missing required fields:', {
                    hasTransactionId: !!transaction.transaction_id,
                    hasAccountId: !!transaction.account_id,
                    hasDate: !!transaction.date,
                    amount: transaction.amount
                });
            }
        });

        // Only process transactions with valid required fields
        const validTransactions = await Promise.all(plaidTransactions
            .filter(transaction => transaction.transaction_id && transaction.account_id && transaction.date)
            .map(async transaction => {
                const matchingAccount = plaidAccounts?.find(
                    account => account.plaidAccountId === transaction.account_id
                );

                // Create base transaction using the Svend account ID from the matching account
                const baseTransaction: FinAccountTransaction = {
                    id: '',
                    plaidTxId: transaction.transaction_id,
                    userTxId: '', // Will be generated
                    date: transaction.date,
                    amount: Math.round(transaction.amount * 100) / 100,
                    plaidDetailedCategory: transaction.personal_finance_category?.detailed || undefined,
                    plaidCategoryConfidence: transaction.personal_finance_category?.confidence_level || undefined,
                    plaidAccountId: matchingAccount?.svendAccountId, // Use the Svend account ID here
                    merchantName: transaction.merchant_name ?? '',
                    payee: transaction.payment_meta?.payee ?? '',
                    status: transaction.pending ? ('pending' as const) : ('posted' as const),
                    isoCurrencyCode: transaction.iso_currency_code ?? 'USD',
                    plaidRawData: transaction,
                };

                const userTxId = await this.generateUserTxIdFromPlaidTx(baseTransaction);
                baseTransaction.userTxId = userTxId;

                // If no matching account or no budget links, return null to filter out
                if (!matchingAccount?.budgetFinAccountIds?.length) {
                    return null;
                }

                // Create a transaction for each budget the account is linked to
                return matchingAccount.budgetFinAccountIds
                    .filter((budgetId): budgetId is string => budgetId !== null)
                    .map(budgetId => ({
                        transaction: { ...baseTransaction, userTxId },
                        budgetFinAccountId: budgetId,
                        categoryGroupId: '',
                        categoryGroup: '',
                        category: {} as Category,
                        merchantName: transaction.merchant_name ?? '',
                        payee: transaction.payment_meta?.payee ?? '',
                        notes: '',
                        budgetTags: [],
                        budgetAttachmentsStorageNames: []
                    }));
            }));

        // Filter out nulls and flatten the array
        const linkedTransactions = validTransactions
            .filter((tx): tx is NonNullable<typeof tx> => tx !== null)
            .flatMap(tx => tx)
            .filter((tx): tx is NonNullable<typeof tx> => tx !== null);

        // Process categories for linked transactions
        const { transactions: processedTransactions, error } = await this.processPlaidCategories(
            linkedTransactions,
            []
        );

        if (error) {
            console.error('Error processing categories:', error);
            return linkedTransactions;
        }

        const finalTransactions = processedTransactions || linkedTransactions;
        return finalTransactions.sort((a, b) => 
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

  private async generateUserTxIdFromRecurringManualTx(
    transactionIds: string[],
    merchantName: string
  ): Promise<string> {
    let isUnique = false;
    let uniqueId: string | undefined;

    // Get all transactions' dates from the group and find the latest
    const { data: transactions } = await this.supabase
      .from('fin_account_transactions')
      .select('date')
      .in('id', transactionIds)
      .order('date', { ascending: false })
      .limit(1);

    const formattedDate = transactions?.[0]?.date.replace(/-/g, '') || 
      new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const merchantHash = merchantName.slice(0, 3).padEnd(3, 'X').toUpperCase();

    while (!isUnique) {
      const potentialIds = Array.from({ length: 10 }, () => {
        const randomCounter = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
        return `M${formattedDate}${randomCounter}${merchantHash}`;
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

  async processPlaidCategories(
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

      const defaultGroup = Object.values(svendCategories).find(group => 
        group.categories.some(cat => cat.name.toLowerCase() === 'others' || cat.name.toLowerCase() === 'other')
      );
      const defaultCategory = defaultGroup?.categories.find(cat => 
        cat.name.toLowerCase() === 'others' || cat.name.toLowerCase() === 'other'
      );

      if (!defaultCategory || !defaultGroup) {
        throw new Error('No default category found in Svend categories');
      }

      // Helper function to find category by Plaid category
      const findCategoryByPlaidCategory = (plaidCategory: string) => {
        const mappedName = plaidMappings[plaidCategory]?.name;
        if (!mappedName) return { 
          category: defaultCategory, 
          groupName: defaultGroup.name, 
          groupId: defaultGroup.id 
        };

        const group = Object.values(svendCategories).find(group =>
          group.categories.some(cat => cat.name === mappedName)
        );
        if (!group) return { 
          category: defaultCategory, 
          groupName: defaultGroup.name, 
          groupId: defaultGroup.id 
        };

        const category = group.categories.find(cat => cat.name === mappedName);
        if (!category) return { 
          category: defaultCategory, 
          groupName: defaultGroup.name, 
          groupId: defaultGroup.id 
        };

        return { category, groupName: group.name, groupId: group.id };
      };

      // Process regular transactions
      const processedTransactions = transactions.map(transaction => {
        const plaidCategory = transaction.transaction.plaidDetailedCategory;
        if (!plaidCategory) {
          console.warn('[Debug] No Plaid category for transaction:', transaction.transaction.plaidTxId);
          return transaction;
        }

        const mappedCategory = findCategoryByPlaidCategory(plaidCategory);
        if (!mappedCategory) {
          console.warn('[Debug] No mapping found for category:', plaidCategory);
          return transaction;
        }

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
        recurringTransactions: recurringTransactions 
      };
    } catch (error: any) {
      console.error('Error in processCategories:', error);
      return { error: `SERVER_ERROR:[processPlaidCategories] ${error.message}` };
    }
  }
  
  async processPlaidCategoriesUnlinked(
    transactions: FinAccountTransaction[],
    recurringTransactions: FinAccountRecurringTransaction[]
  ): Promise<{ 
    transactions?: FinAccountTransaction[], 
    recurringTransactions?: FinAccountRecurringTransaction[],
    error?: string 
  }> {
    try {
      // Get unique Plaid categories from both transaction types
      const uniquePlaidCategories = [...new Set([
        ...transactions.map(t => t.plaidDetailedCategory),
        ...recurringTransactions.map(t => t.plaidDetailedCategory)
      ].filter((cat): cat is string => !!cat))];

      // Get mappings and categories
      const [plaidMappings, svendCategories] = await Promise.all([
        this.categoryService.mapPlaidCategoriesToSvendCategories(uniquePlaidCategories),
        this.categoryService.getSvendDefaultCategoryGroups()
      ]);

      if (!plaidMappings || !svendCategories) {
        throw new Error('Category mapping or categories fetch returned null or undefined');
      }

      const defaultGroup = Object.values(svendCategories).find(group => 
        group.categories.some(cat => cat.name.toLowerCase() === 'others' || cat.name.toLowerCase() === 'other')
      );
      const defaultCategory = defaultGroup?.categories.find(cat => 
        cat.name.toLowerCase() === 'others' || cat.name.toLowerCase() === 'other'
      );

      if (!defaultCategory || !defaultGroup) {
        throw new Error('No default category found in Svend categories');
      }

      // Helper function to find category by Plaid category
      const findCategoryByPlaidCategory = (plaidCategory: string) => {
        const mappedName = plaidMappings[plaidCategory]?.name;
        if (!mappedName) return { 
          category: defaultCategory, 
          groupName: defaultGroup.name, 
          groupId: defaultGroup.id 
        };

        const group = Object.values(svendCategories).find(group =>
          group.categories.some(cat => cat.name === mappedName)
        );
        if (!group) return { 
          category: defaultCategory, 
          groupName: defaultGroup.name, 
          groupId: defaultGroup.id 
        };

        const category = group.categories.find(cat => cat.name === mappedName);
        if (!category) return { 
          category: defaultCategory, 
          groupName: defaultGroup.name, 
          groupId: defaultGroup.id 
        };

        return { category, groupName: group.name, groupId: group.id };
      };

      // Process regular transactions
      const processedTransactions = transactions.map(transaction => {
        const plaidCategory = transaction.plaidDetailedCategory;
        if (!plaidCategory) {
          console.warn('[Debug] No Plaid category for transaction:', transaction.plaidTxId);
          // Use default category instead of returning without category
          const defaultMapping = { 
            category: defaultCategory, 
            groupName: defaultGroup.name, 
            groupId: defaultGroup.id 
          };
          return {
            ...transaction,
            svendCategoryId: defaultCategory.id,  // Make sure to set this
            category: defaultMapping.category,
            categoryGroup: defaultMapping.groupName,
            categoryGroupId: defaultMapping.groupId
          };
        }

        const mappedCategory = findCategoryByPlaidCategory(plaidCategory);
        if (!mappedCategory) {
          console.warn('[Debug] No mapping found for category:', plaidCategory);
          // Use default category instead of returning without category
          return {
            ...transaction,
            svendCategoryId: defaultCategory.id,  // Make sure to set this
            category: defaultCategory,
            categoryGroup: defaultGroup.name,
            categoryGroupId: defaultGroup.id
          };
        }

        return {
          ...transaction,
          svendCategoryId: mappedCategory.category.id,  // Make sure to set this
          category: mappedCategory.category,
          categoryGroup: mappedCategory.groupName,
          categoryGroupId: mappedCategory.groupId
        };
      });

      // Process recurring transactions
      const processedRecurringTransactions = recurringTransactions.map(tx => {
        const plaidCategory = tx.plaidDetailedCategory;
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
        recurringTransactions: recurringTransactions 
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
    try {
      // First get the budget and its plaid items
      const { data: plaidItems, error: plaidItemsError } = await this.supabase
        .rpc('get_budget_plaid_items', { 
          p_team_account_slug: teamAccountSlug 
        });

      if (plaidItemsError) throw plaidItemsError;
      if (!plaidItems?.length) {
        return { 
          data: {
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
        plaidAccounts: (item.plaid_accounts as PlaidConnectionItemAccountSummary[]) || []
      }));

      // We already checked plaidItems.length above, so first item exists
      const { data, error } = await this.syncPlaidTransactions(
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

  async mergeBudgetFinAccountRecurringTransaction(
    newTransactions: BudgetFinAccountRecurringTransaction[],
    budgetId: string
  ): Promise<ServiceResult<null>> {
    try {
      // Get all existing recurring transactions
      const { data: existingTransactions, error: fetchError } = await this.supabase
        .from('fin_account_recurring_transactions')
        .select('*');

      if (fetchError) throw fetchError;

      // Create maps for both lookup methods
      const existingByFinAccountId = new Map<string, any>();
      const existingByPlaidId = new Map<string, any>();
      
      existingTransactions?.forEach(tx => {
        // Map for manual transaction lookup
        tx.fin_account_transaction_ids?.forEach(id => {
          existingByFinAccountId.set(id, tx);
        });
        // Map for Plaid transaction lookup
        if (tx.plaid_tx_id) {
          existingByPlaidId.set(tx.plaid_tx_id, tx);
        }
      });

      const transactionsToInsert: BudgetFinAccountRecurringTransaction[] = [];

      // Process each new transaction
      for (const newTx of newTransactions) {
        const isManual = !newTx.transaction.plaidTxId;
        
        if (isManual) {
          // Handle manual recurring transactions (existing logic)
          if (newTx.transaction.finAccountTransactionIds?.length) {
            const existingRecords = newTx.transaction.finAccountTransactionIds
              .map(id => existingByFinAccountId.get(id))
              .filter(Boolean);

            if (existingRecords.length > 0) {
              // Get the oldest record
              const oldest = existingRecords.reduce((a, b) => 
                new Date(a.updated_at || '1970-01-01') < new Date(b.updated_at || '1970-01-01') ? a : b
              );

              // Collect all unique transaction IDs
              const allIds = new Set([
                ...(oldest.fin_account_transaction_ids || []),
                ...(newTx.transaction.finAccountTransactionIds || [])
              ]);

              // Update the oldest record with all IDs
              const { error: updateError } = await this.supabase
                .from('fin_account_recurring_transactions')
                .update({
                  fin_account_transaction_ids: Array.from(allIds),
                  updated_at: new Date().toISOString()
                })
                .eq('id', oldest.id);

              if (updateError) throw updateError;

              // Delete any duplicates
              if (existingRecords.length > 1) {
                const idsToDelete = existingRecords
                  .filter(r => r.id !== oldest.id)
                  .map(r => r.id);

                const { error: deleteError } = await this.supabase
                  .from('fin_account_recurring_transactions')
                  .delete()
                  .in('id', idsToDelete);

                if (deleteError) throw deleteError;
              }
            } else {
              transactionsToInsert.push(newTx);
            }
          }
        } else {
          // Handle Plaid recurring transactions
          const existing = existingByPlaidId.get(newTx.transaction.plaidTxId!);
          if (existing) {
            // Update existing Plaid recurring transaction
            const { error: updateError } = await this.supabase
              .from('fin_account_recurring_transactions')
              .update({
                fin_account_transaction_ids: newTx.transaction.finAccountTransactionIds,
                plaid_raw_data: newTx.transaction.plaidRawData as any,
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id);

            if (updateError) throw updateError;
          } else {
            transactionsToInsert.push(newTx);
          }
        }
      }

      // Insert new transactions
      console.warn(`transaction service > merge recurring > persisting ${transactionsToInsert.length} linked recurring transactions..`);
      if (transactionsToInsert.length > 0) {
        const { error: saveError } = await this.saveBudgetRecurringTransactions(transactionsToInsert, budgetId);
        if (saveError) throw saveError;
      }

      return { data: null, error: null };
    } catch (error: any) {
      console.error('Error in mergeBudgetFinAccountRecurringTransaction:', error);
      return { data: null, error: error.message };
    }
  }

  /**
   * Merges unlinked recurring transactions, handling duplicates based on fin_account_transaction_ids
   */
  async mergeFinAccountRecurringTransactions(
    transactions: FinAccountRecurringTransaction[]
  ): Promise<ServiceResult<null>> {
    try {
      // Get all existing recurring transactions
      const { data: existingTransactions, error: fetchError } = await this.supabase
        .from('fin_account_recurring_transactions')
        .select('*');

      if (fetchError) throw fetchError;

      // Create map for fin_account_transaction_ids lookup
      const existingByFinAccountId = new Map<string, any>();
      existingTransactions?.forEach(tx => {
        tx.fin_account_transaction_ids?.forEach(id => {
          existingByFinAccountId.set(id, tx);
        });
      });

      const transactionsToInsert: FinAccountRecurringTransaction[] = [];

      // Process each transaction
      for (const newTx of transactions) {
        if (newTx.finAccountTransactionIds?.length) {
          const existingRecords = newTx.finAccountTransactionIds
            .map(id => existingByFinAccountId.get(id))
            .filter(Boolean);

          if (existingRecords.length > 0) {
            // Get the oldest record
            const oldest = existingRecords.reduce((a, b) => 
              new Date(a.updated_at || '1970-01-01') < new Date(b.updated_at || '1970-01-01') ? a : b
            );

            // Collect all unique transaction IDs
            const allIds = new Set([
              ...(oldest.fin_account_transaction_ids || []),
              ...(newTx.finAccountTransactionIds || [])
            ]);

            // Update the oldest record with all IDs
            const { error: updateError } = await this.supabase
              .from('fin_account_recurring_transactions')
              .update({
                fin_account_transaction_ids: Array.from(allIds),
                updated_at: new Date().toISOString()
              })
              .eq('id', oldest.id);

            if (updateError) throw updateError;

            // Delete any duplicates
            if (existingRecords.length > 1) {
              const idsToDelete = existingRecords
                .filter(r => r.id !== oldest.id)
                .map(r => r.id);

              const { error: deleteError } = await this.supabase
                .from('fin_account_recurring_transactions')
                .delete()
                .in('id', idsToDelete);

              if (deleteError) throw deleteError;
            }
          } else {
            transactionsToInsert.push(newTx);
          }
        } else {
          transactionsToInsert.push(newTx);
        }
      }

      // Insert new transactions
      console.warn(`transaction service > merge recurring > persisting ${transactionsToInsert.length} unlinked recurring transactions..`);
      if (transactionsToInsert.length > 0) {
        const { error } = await this.supabase
          .from('fin_account_recurring_transactions')
          .insert(transactionsToInsert.map(tx => ({
            user_tx_id: tx.userTxId,
            plaid_tx_id: tx.plaidTxId,
            fin_account_transaction_ids: tx.finAccountTransactionIds,
            svend_category_id: tx.svendCategoryId || '',
            plaid_account_id: tx.plaidAccountId,
            manual_account_id: tx.manualAccountId,
            plaid_category_detailed: tx.plaidDetailedCategory,
            plaid_category_confidence: tx.plaidCategoryConfidence,
            plaid_raw_data: tx.plaidRawData as any
          })));

        if (error) throw error;
      }

      return { data: null, error: null };
    } catch (error: any) {
      console.error('Error in mergeFinAccountRecurringTransactions:', error);
      return { data: null, error: error.message };
    }
  }

  /**
   * Enriches manual transactions using Plaid's Enrich API
   * @param accounts Record of accounts and their transactions
   */
  async enrichManualTransactions(
    accounts: Record<string, {
      account: FinAccount,
      transactions: FinAccountTransaction[]
    }>,
    plaidClient: PlaidApi
  ): Promise<Record<string, FinAccountTransaction[]>> {
    try {
      const result: Record<string, FinAccountTransaction[]> = {};
      const isSandboxMode = process.env.PLAID_ENV === 'sandbox';
      let presetTransactions: any[] = [];
      
      if (isSandboxMode) {
        presetTransactions = require('../config/plaid_enrich_preset_txs.json');
      }
      
      for (const [accountId, { account, transactions }] of Object.entries(accounts)) {
        // Skip transactions that already have plaid_raw_data
        const unenrichedTransactions = transactions.filter(tx => !tx.plaidRawData);
        if (unenrichedTransactions.length === 0) {
          result[accountId] = transactions;
          continue;
        }

        if (isSandboxMode) {
          const enrichableTransactions = unenrichedTransactions.filter(tx => 
            presetTransactions.some(p => p.id === tx.userTxId)
          );

          if (enrichableTransactions.length === 0) {
            result[accountId] = transactions;
            continue;
          }

          const enrichRequest: TransactionsEnrichRequest = {
            account_type: 'depository',
            transactions: enrichableTransactions.map(tx => {
              const preset = presetTransactions.find(p => p.id === tx.userTxId);
              return {
                id: tx.userTxId,
                description: preset.description,
                amount: Math.abs(preset.amount),
                iso_currency_code: preset.iso_currency_code,
                direction: preset.direction,
                ...(preset.city && preset.region ? {
                  location: {
                    city: preset.city,
                    region: preset.region
                  }
                } : {})
              };
            })
          };

          let enrichResponse;
          try {
            enrichResponse = await plaidClient.transactionsEnrich(enrichRequest);
          } catch (error) {
            console.warn('First enrichment attempt failed, retrying once...', error);
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
              enrichResponse = await plaidClient.transactionsEnrich(enrichRequest);
            } catch (retryError) {
              console.error('Enrichment retry failed, skipping:', retryError);
              result[accountId] = transactions;
              continue;
            }
          }

          const enrichedTransactions = enrichResponse.data.enriched_transactions;
          
          result[accountId] = transactions.map(tx => {
            if (tx.plaidRawData) return tx;
            const enriched = enrichedTransactions.find(e => e.id === tx.userTxId);
            if (!enriched) return tx;

            return {
              ...tx,
              merchantName: enriched?.enrichments.merchant_name || tx.merchantName,
              plaidDetailedCategory: enriched?.enrichments.personal_finance_category?.detailed,
              plaidCategoryConfidence: enriched?.enrichments.personal_finance_category?.confidence_level ?? undefined,
              plaidRawData: enriched as unknown as Transaction
            };
          });
        } else {
          // Production code - enrich all transactions
          const enrichRequest: TransactionsEnrichRequest = {
            account_type: 'depository',
            transactions: unenrichedTransactions.map(tx => ({
              id: tx.userTxId,
              description: tx.merchantName || tx.payee || '',
              amount: Math.abs(tx.amount),
              iso_currency_code: tx.isoCurrencyCode || 'USD',
              date_posted: tx.date,
              direction: tx.amount >= 0 ? EnrichTransactionDirection.Outflow : EnrichTransactionDirection.Inflow
            }))
          };

          let enrichResponse;
          try {
            enrichResponse = await plaidClient.transactionsEnrich(enrichRequest);
          } catch (error) {
            console.warn('First enrichment attempt failed, retrying once...', error);
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
              enrichResponse = await plaidClient.transactionsEnrich(enrichRequest);
            } catch (retryError) {
              console.error('Enrichment retry failed, skipping:', retryError);
              result[accountId] = transactions;
              continue;
            }
          }

          const enrichedTransactions = enrichResponse.data.enriched_transactions;
          
          result[accountId] = transactions.map(tx => {
            if (tx.plaidRawData) return tx;
            const enriched = enrichedTransactions.find(e => e.id === tx.userTxId);
            if (!enriched) return tx;

            return {
              ...tx,
              merchantName: enriched?.enrichments.merchant_name || tx.merchantName,
              plaidDetailedCategory: enriched?.enrichments.personal_finance_category?.detailed,
              plaidCategoryConfidence: enriched?.enrichments.personal_finance_category?.confidence_level ?? undefined,
              plaidRawData: enriched as unknown as Transaction
            };
          });
        }
      }

      return result;
    } catch (error) {
      console.error('Error enriching manual transactions:', error);
      return Object.fromEntries(
        Object.entries(accounts).map(([id, { transactions }]) => [id, transactions])
      );
    }
  }

  /**
   * Processes manual transactions to detect recurring patterns
   * Similar to processPlaidRecurringTransactions but for manual transactions
   */
  async processManualRecurringTransactions(
    transactions: BudgetFinAccountTransaction[]
  ): Promise<BudgetFinAccountRecurringTransaction[]> {
    try {
      // First filter for transactions marked as recurring by Plaid
      const recurringTxs = transactions.filter(tx => 
        (tx.transaction.plaidRawData as any)?.enrichments?.recurrence?.is_recurring
      );
      
      // Group transactions by merchant + amount + frequency
      const groupedByPattern = new Map<string, BudgetFinAccountTransaction[]>();
      recurringTxs.forEach(tx => {
        const amount = tx.transaction.amount;
        const frequency = (tx.transaction.plaidRawData as any)?.enrichments?.recurrence?.frequency;
        const key = [
          tx.transaction.merchantName || tx.transaction.payee || '',
          Math.round(Math.abs(amount) * 100),
          frequency
        ].join('|');

        if (!groupedByPattern.has(key)) {
          groupedByPattern.set(key, []);
        }
        groupedByPattern.get(key)!.push(tx);
      });

      // Inside processManualRecurringTransactions, after grouping transactions:
      console.log('[Debug] Manual recurring transactions:', {
        totalGroups: groupedByPattern.size,
        sampleGroup: Array.from(groupedByPattern.entries())[0]?.[1].map(tx => ({
          id: tx.transaction?.id,
          merchantName: tx.transaction?.merchantName,
          amount: tx.transaction?.amount
        }))
      });

      // Create recurring transaction groups
      const recurringGroups = Array.from(groupedByPattern.entries()).map(async ([key, txs]) => {
        console.log('[Debug] Processing recurring group:', {
          key,
          transactionCount: txs.length,
          transactionIds: txs.map(tx => tx.transaction.id),
          firstTransaction: {
            id: txs[0]?.transaction.id,
            manualAccountId: txs[0]?.transaction.manualAccountId
          }
        });

        const [merchantName, , frequency] = key.split('|');
        
        // Use the first transaction as the source of truth
        const firstTx = txs[0];
        if (!firstTx) {
          throw new Error(`No transactions found for pattern ${key}`);
        }

        // Get category from either the transaction or category object
        const categoryId = firstTx.category?.id || firstTx.transaction.svendCategoryId;
        if (!categoryId) {
          console.error('Missing category for transaction:', {
            tx: firstTx.transaction,
            category: firstTx.category,
            rawTransaction: firstTx
          });
          throw new Error(`Missing category ID for manual recurring transaction ${merchantName}`);
        }

        const transactionIds = txs.map(tx => tx.transaction.id);
        console.log('[Debug] Creating recurring transaction:', {
          merchantName,
          transactionCount: txs.length,
          transactionIds,
          firstTxId: firstTx.transaction.id
        });

        const stream: TransactionStream = {
          stream_id: firstTx.transaction.id,
          description: merchantName,
          first_date: firstTx.transaction.date,
          last_date: firstTx.transaction.date,
          status: TransactionStreamStatus.Unknown,
          transaction_ids: txs.map(tx => tx.transaction.id),  // This is for Plaid's transaction_ids
          account_id: firstTx.transaction.plaidAccountId || '',
          personal_finance_category: firstTx.transaction.plaidDetailedCategory,
          frequency: frequency,
          is_active: true
        } as any;

        const result = {
          transaction: {
            id: '',
            manualAccountId: firstTx.transaction.manualAccountId,
            userTxId: await this.generateUserTxIdFromRecurringManualTx(
              txs.map(tx => tx.transaction.id),
              merchantName || ''
            ),
            plaidDetailedCategory: firstTx.transaction.plaidDetailedCategory,
            plaidCategoryConfidence: firstTx.transaction.plaidCategoryConfidence,
            finAccountTransactionIds: txs.map(tx => tx.transaction.id),
            plaidRawData: stream,
            svendCategoryId: categoryId
          },
          budgetFinAccountId: firstTx.budgetFinAccountId,
          category: categoryId,
          categoryGroup: firstTx.categoryGroup || '',
          categoryGroupId: firstTx.categoryGroupId || '',
          notes: '',
          budgetTags: []
        };

        console.log('[Debug] Created recurring transaction:', {
          userTxId: result.transaction.userTxId,
          finAccountTransactionIds: result.transaction.finAccountTransactionIds,
          manualAccountId: result.transaction.manualAccountId
        });

        return result;
      });

      const results = await Promise.all(recurringGroups);
      
      console.log('[Debug] Final recurring transactions:', results.map(r => ({
        userTxId: r.transaction.userTxId,
        finAccountTransactionIds: r.transaction.finAccountTransactionIds,
        manualAccountId: r.transaction.manualAccountId
      })));

      return results;
    } catch (error: any) {
      console.error('[processManualRecurringTransactions] Error:', error);
      return [];
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
  mergeBudgetFinAccountRecurringTransaction: (
    newTransactions: BudgetFinAccountRecurringTransaction[],
    budgetId: string
  ) => Promise<ServiceResult<null>>;
  mergeFinAccountRecurringTransactions: (
    newTransactions: FinAccountRecurringTransaction[]
  ) => Promise<ServiceResult<null>>;
  syncPlaidTransactions: (
    plaidConnectionItems: PlaidConnectionItemSummary[],
    plaidClient: PlaidApi
  ) => Promise<ServiceResult<PlaidSyncTransactionsResponse>>;
  syncPlaidTransactionsFinAccountMgmt: (
    plaidConnectionItems: PlaidConnectionItemSummary[],
    plaidClient: PlaidApi
  ) => Promise<ServiceResult<PlaidSyncTransactionsResponse>>;
  syncPlaidTransactionsByTeamAccountSlug: (
    teamAccountSlug: string,
    plaidClient: PlaidApi
  ) => Promise<ServiceResult<PlaidSyncTransactionsResponse>>;
  enrichManualTransactions: (
    accounts: Record<string, {
      account: FinAccount,
      transactions: FinAccountTransaction[]
    }>,
    plaidClient: PlaidApi
  ) => Promise<Record<string, FinAccountTransaction[]>>;
  processManualRecurringTransactions: (
    transactions: BudgetFinAccountTransaction[]
  ) => Promise<BudgetFinAccountRecurringTransaction[]>;
  processPlaidCategories: (
    transactions: BudgetFinAccountTransaction[],
    recurringTransactions: BudgetFinAccountRecurringTransaction[]
  ) => Promise<{ 
    transactions?: BudgetFinAccountTransaction[], 
    recurringTransactions?: BudgetFinAccountRecurringTransaction[],
    error?: string 
  }>;
}

export type ServiceResult<T> = {
  data: T | null;
  error: string | null;
};

export type PlaidConnectionItemAccountSummary = {
  svendAccountId: string;
  plaidAccountId: string;
  budgetFinAccountIds: string[];
};

export type PlaidConnectionItemSummary = {
  svendItemId: string;
  accessToken: string;
  nextCursor: string;
  plaidAccounts: PlaidConnectionItemAccountSummary[];
};

export interface PlaidSyncTransactionsResponse {
  // budgetId?: string;
  newTransactions: BudgetFinAccountTransaction[];
  newUnlinkedTransactions: FinAccountTransaction[];
  recurringTransactions: BudgetFinAccountRecurringTransaction[];
  recurringUnlinkedTransactions: FinAccountRecurringTransaction[];
  modifiedTransactions: BudgetFinAccountTransaction[];
}
