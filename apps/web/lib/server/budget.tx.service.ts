import { Database } from '../database.types';
import { SupabaseClient } from '@supabase/supabase-js';
import { BudgetFinAccountTransaction, BudgetFinAccountRecurringTransaction } from '../model/budget.types';
import { ICategoryService } from './category.service';
import { Category } from '../model/fin.types';

/**
 * @name BudgetTransactionService
 * @description Service for parsing and processing budget transactions
 */
export class BudgetTransactionService implements IBudgetTransactionService {
  private supabase: SupabaseClient<Database>;
  private categoryService: ICategoryService;

  constructor(
    supabaseClient: SupabaseClient,
    categoryService: ICategoryService
  ) {
    this.supabase = supabaseClient;
    this.categoryService = categoryService;
  }

  /**
   * Parses raw budget transactions from the database into BudgetFinAccountTransaction objects
   */
  parseBudgetTransactions(raw: Database['public']['Functions']['get_budget_transactions_by_team_account_slug']['Returns']): BudgetFinAccountTransaction[] {
    try {
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
              svendCategoryId: budgetTransaction.svend_category_id
            },
            budgetFinAccountId: budgetTransaction.budget_fin_account_id,
            categoryGroupId: budgetTransaction.svend_category_group_id,
            categoryGroup: budgetTransaction.svend_category_group,
            category: {
              id: budgetTransaction.svend_category_id,
              name: budgetTransaction.svend_category,
              isDiscretionary: false, // This will be set by the category service
              createdAt: new Date().toISOString(), // This will be set by the category service
              updatedAt: new Date().toISOString() // This will be set by the category service
            },
            merchantName: budgetTransaction.merchant_name,
            payee: budgetTransaction.payee,
            notes: budgetTransaction.notes,
            budgetTags: (budgetTransaction.tags as any[] ?? []).map((tag: any) => ({
              id: tag.id || tag,
              name: tag.name || tag
            })),
            budgetAttachmentsStorageNames: [] // This will be populated by the attachment service
          };

          validTransactions.push(validTransaction);
        } catch (error) {
          console.error('Error parsing transaction:', error);
        }
        return validTransactions;
      }, []);
    } catch (error) {
      console.error('Error parsing budget transactions:', error);
      return [];
    }
  }

  /**
   * Processes Plaid categories for transactions and recurring transactions
   */
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
        recurringTransactions: processedRecurringTransactions 
      };
    } catch (error: any) {
      console.error('Error in processCategories:', error);
      return { error: `SERVER_ERROR:[processPlaidCategories] ${error.message}` };
    }
  }
}

/**
 * Creates an instance of the BudgetTransactionService.
 * @param supabaseClient - The Supabase client instance
 * @param categoryService - The category service instance
 * @returns An instance of BudgetTransactionService.
 */
export function createBudgetTransactionService(
  supabaseClient: SupabaseClient,
  categoryService: ICategoryService
): IBudgetTransactionService {
  return new BudgetTransactionService(supabaseClient, categoryService);
}

export interface IBudgetTransactionService {
  parseBudgetTransactions: (raw: Database['public']['Functions']['get_budget_transactions_by_team_account_slug']['Returns']) => BudgetFinAccountTransaction[];
  processPlaidCategories: (
    transactions: BudgetFinAccountTransaction[],
    recurringTransactions: BudgetFinAccountRecurringTransaction[]
  ) => Promise<{ 
    transactions?: BudgetFinAccountTransaction[], 
    recurringTransactions?: BudgetFinAccountRecurringTransaction[],
    error?: string 
  }>;
} 