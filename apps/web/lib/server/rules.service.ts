import { Database } from '../database.types';
import { SupabaseClient } from '@supabase/supabase-js';
import { BudgetRule, BudgetFinAccountTransaction } from '../model/budget.types';
import { ServiceResult } from './transaction.service';
import { z } from 'zod';
import { ITransactionService } from './transaction.service';
import { TransactionService } from './transaction.service';
import { createBudgetTransactionService, IBudgetTransactionService } from './budget.tx.service';
import { createCategoryService } from './category.service';

const ruleSchema = z.object({
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

type RuleInput = z.infer<typeof ruleSchema>;

/**
 * @name RulesService
 * @description Service for processing and applying budget rules to transactions
 */
export class RulesService implements IRulesService {
  private supabase: SupabaseClient;
  private transactionService: ITransactionService | null = null;
  private budgetTransactionService: IBudgetTransactionService;

  constructor(
    supabaseClient: SupabaseClient,
    transactionService: ITransactionService
  ) {
    this.supabase = supabaseClient;
    this.transactionService = transactionService;
    const categoryService = createCategoryService(supabaseClient);
    this.budgetTransactionService = createBudgetTransactionService(supabaseClient, categoryService);
  }

  /**
   * Parses a raw database rule into a BudgetRule
   */
  private parseRule(rule: Database['public']['Tables']['budget_rules']['Row']): BudgetRule {
    return {
      id: rule.id,
      budgetId: rule.budget_id,
      name: rule.name,
      isActive: rule.is_active,
      conditions: rule.conditions as BudgetRule['conditions'],
      actions: rule.actions as BudgetRule['actions'],
      createdAt: rule.created_at,
      updatedAt: rule.updated_at
    };
  }

  /**
   * Creates a new rule
   */
  async createRule(input: RuleInput): Promise<ServiceResult<BudgetRule>> {
    try {
      type CreateBudgetRuleResponse = {
        id: string;
        budget_id: string;
        name: string;
        is_active: boolean;
        conditions: BudgetRule['conditions'];
        actions: BudgetRule['actions'];
        created_at: string;
        updated_at: string;
      };

      const { data: newRule, error } = await this.supabase
        .rpc('create_budget_rule', {
          p_budget_id: input.budgetId,
          p_name: input.name,
          p_conditions: input.conditions,
          p_actions: input.actions,
          p_is_active: input.isActive,
          p_is_applied_to_all_transactions: input.isAppliedToAllTransactions
        })
        .single<CreateBudgetRuleResponse>();

      if (error) throw error;

      const parsedRule: BudgetRule = {
        id: newRule.id,
        budgetId: newRule.budget_id,
        name: newRule.name,
        isActive: newRule.is_active,
        conditions: newRule.conditions,
        actions: newRule.actions,
        createdAt: newRule.created_at,
        updatedAt: newRule.updated_at
      };

      // Apply rules to existing transactions if needed
      if (parsedRule.isActive && input.isAppliedToAllTransactions) {
        const { error: applyError } = await this.applyRulesToExistingTransactions(
          input.budgetId,
          parsedRule
        );

        if (applyError) {
          console.error('Error applying rules to existing transactions:', applyError);
        }
      }

      return { data: parsedRule, error: null };
    } catch (error: any) {
      console.error('Error creating rule:', error);
      return { data: null, error: error.message };
    }
  }

  /**
   * Updates an existing rule
   */
  async updateRule(id: string, input: Partial<RuleInput>): Promise<ServiceResult<BudgetRule>> {
    try {
      const { data: updatedRule, error } = await this.supabase
        .from('budget_rules')
        .update({
          name: input.name,
          conditions: input.conditions,
          actions: input.actions,
          is_active: input.isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const parsedRule: BudgetRule = {
        id: updatedRule.id,
        budgetId: updatedRule.budget_id,
        name: updatedRule.name,
        isActive: updatedRule.is_active,
        conditions: updatedRule.conditions as BudgetRule['conditions'],
        actions: updatedRule.actions as BudgetRule['actions'],
        createdAt: updatedRule.created_at,
        updatedAt: updatedRule.updated_at
      };

      return { data: parsedRule, error: null };
    } catch (error: any) {
      console.error('Error updating rule:', error);
      return { data: null, error: error.message };
    }
  }

  /**
   * Updates the order of rules
   */
  async updateRuleOrder(budgetId: string, ruleOrders: string[]): Promise<ServiceResult<null>> {
    try {
      // Simply update the rule_order array in the budgets table
      const { error } = await this.supabase
        .from('budgets')
        .update({ rule_order: ruleOrders })
        .eq('id', budgetId);

      if (error) throw error;

      return { data: null, error: null };
    } catch (error: any) {
      console.error('Error updating rule order:', error);
      return { data: null, error: error.message };
    }
  }

  private async cleanupRuleOrder(budgetId: string): Promise<void> {
    const { data: budget } = await this.supabase
      .from('budgets')
      .select('rule_order')
      .eq('id', budgetId)
      .single();

    if (!budget?.rule_order) return;

    const { data: existingRules } = await this.supabase
      .from('budget_rules')
      .select('id')
      .eq('budget_id', budgetId);

    const existingRuleIds = new Set(existingRules?.map((rule: { id: string }) => rule.id) || []);
    const validRuleOrder = budget.rule_order.filter((id: string) => existingRuleIds.has(id));

    if (validRuleOrder.length !== budget.rule_order.length) {
      await this.supabase
        .from('budgets')
        .update({ rule_order: validRuleOrder })
        .eq('id', budgetId);
    }
  }

  /**
   * Deletes a rule
   */
  async deleteRule(id: string): Promise<ServiceResult<null>> {
    try {
      const { error } = await this.supabase
        .rpc('delete_budget_rule', {
          p_rule_id: id
        });

      if (error) throw error;
      return { data: null, error: null };
    } catch (error: any) {
      console.error('Error deleting rule:', error);
      return { data: null, error: error.message };
    }
  }

  /**
   * Gets all rules for a budget
   */
  async getBudgetRules(budgetId: string): Promise<ServiceResult<BudgetRule[]>> {
    try {
      // First get the rule_order from the budget
      const { data: budget, error: budgetError } = await this.supabase
        .from('budgets')
        .select('rule_order')
        .eq('id', budgetId)
        .single();

      if (budgetError) throw budgetError;

      // Then get all rules for this budget
      const { data: rules, error } = await this.supabase
        .from('budget_rules')
        .select('*')
        .eq('budget_id', budgetId);

      if (error) throw error;

      // Parse database rules to BudgetRule model immediately
      const parsedRules = (rules as Database['public']['Tables']['budget_rules']['Row'][]).map(rule => this.parseRule(rule));

      // Create a map for quick lookup using our domain model
      const rulesMap = new Map(parsedRules.map(rule => [rule.id, rule]));

      // Sort rules according to the rule_order array
      const orderedRules = (budget.rule_order || [])
        .map((id: string) => rulesMap.get(id))
        .filter((rule: unknown): rule is BudgetRule => rule !== undefined)
        .concat(parsedRules.filter((rule: BudgetRule) => !budget.rule_order.includes(rule.id)));

      return { data: orderedRules, error: null };
    } catch (error: any) {
      console.error('Error getting budget rules:', error);
      return { data: null, error: error.message };
    }
  }

  /**
   * Applies rules to a set of transactions
   */
  async applyRulesToTransactions(
    transactions: BudgetFinAccountTransaction[],
    rules: BudgetRule[],
    budgetId: string
  ): Promise<BudgetFinAccountTransaction[]> {
    try {
      // Get active rules for this budget
      const { data: budget } = await this.supabase
        .from('budgets')
        .select('rule_order')
        .eq('id', budgetId)
        .single();

      const activeRules = rules
        .filter(rule => rule.isActive)
        .sort((a, b) => {
          const aIndex = budget?.rule_order?.indexOf(a.id) ?? -1;
          const bIndex = budget?.rule_order?.indexOf(b.id) ?? -1;
          return aIndex - bIndex;
        });
      
      // Process each transaction
      const processedTransactions = await Promise.all(
        transactions.map(async transaction => {
          // Create a mutable copy of the transaction that we'll update as rules are applied
          let processedTransaction = { ...transaction };

          // Apply each rule in sequence, using the processed transaction data for matching
          for (const rule of activeRules) {
            // Check if the rule matches using the processed transaction data
            if (this.doesTransactionMatchRule(processedTransaction, rule)) {
              // Apply changes to the processed transaction
              processedTransaction = this.applyRuleActions(processedTransaction, rule);
            }
          }

          return processedTransaction;
        })
      );

      return processedTransactions;
    } catch (error) {
      console.error('Error applying rules to transactions:', error);
      return transactions;
    }
  }

  /**
   * Checks if a transaction matches a rule's conditions
   */
  private doesTransactionMatchRule(
    transaction: BudgetFinAccountTransaction,
    rule: BudgetRule
  ): boolean {
    const { conditions } = rule;

    // Check merchant name condition
    if (conditions.merchantName?.enabled) {
      const merchantName = (transaction.merchantName || transaction.transaction.merchantName || transaction.transaction.payee || '').toLowerCase();
      const ruleValue = (conditions.merchantName.value || '').toLowerCase();
      
      if (conditions.merchantName.matchType === 'contains') {
        if (!merchantName.includes(ruleValue)) {
          return false;
        }
      } else if (conditions.merchantName.matchType === 'exactly') {
        if (merchantName !== ruleValue) {
          return false;
        }
      }
    }

    // Check amount condition
    if (conditions.amount?.enabled) {
      const amount = Math.abs(transaction.transaction.amount);
      if (conditions.amount.matchType === 'exactly') {
        if (amount !== Number(conditions.amount.value)) {
          return false;
        }
      } else if (conditions.amount.matchType === 'between') {
        const start = Number(conditions.amount.rangeStart);
        const end = Number(conditions.amount.rangeEnd);
        if (amount < start || amount > end) {
          return false;
        }
      }
    }

    // Check date condition
    if (conditions.date?.enabled) {
      const transactionDate = new Date(transaction.transaction.date + 'T00:00:00Z');
      const dayOfMonth = transactionDate.getUTCDate();
      
      if (conditions.date.matchType === 'exactly') {
        if (dayOfMonth !== Number(conditions.date.value)) {
          return false;
        }
      } else if (conditions.date.matchType === 'between') {
        const start = Number(conditions.date.rangeStart);
        const end = Number(conditions.date.rangeEnd);
        
        if (dayOfMonth < start || dayOfMonth > end) {
          return false;
        }
      }
    }

    // Check account condition
    if (conditions.account?.enabled) {
      console.log('Account matching debug:', {
        transactionId: transaction.transaction.id,
        budgetFinAccountId: transaction.budgetFinAccountId,
        ruleAccountValue: conditions.account.value,
        merchantName: transaction.merchantName || transaction.transaction.merchantName,
        amount: transaction.transaction.amount,
        date: transaction.transaction.date
      });

      if (transaction.budgetFinAccountId !== conditions.account.value) {
        console.log('Account match failed:', {
          transactionId: transaction.transaction.id,
          budgetFinAccountId: transaction.budgetFinAccountId,
          ruleAccountValue: conditions.account.value
        });
        return false;
      }
      console.log('Account matched successfully');
    }

    return true;
  }

  /**
   * Applies a rule's actions to a transaction
   */
  private applyRuleActions(
    transaction: BudgetFinAccountTransaction,
    rule: BudgetRule
  ): BudgetFinAccountTransaction {
    const { actions } = rule;
    let processedTransaction = { ...transaction };

    // Store original category ID before any changes
    const originalCategoryId = transaction.category.id;

    console.log('Applying rule actions:', {
      transactionId: transaction.transaction.id,
      actions: actions,
      currentNotes: transaction.notes,
      originalCategoryId,
      currentCategory: transaction.category
    });

    // Apply category action
    if (actions.setCategory?.enabled && actions.setCategory.value) {
      console.log('Setting category:', {
        transactionId: transaction.transaction.id,
        oldCategoryId: originalCategoryId,
        newCategoryId: actions.setCategory.value,
        categoryChanged: originalCategoryId !== actions.setCategory.value
      });
      processedTransaction = {
        ...processedTransaction,
        category: {
          ...processedTransaction.category,
          id: actions.setCategory.value
        },
        transaction: {
          ...processedTransaction.transaction,
          svendCategoryId: actions.setCategory.value
        }
      };
    }

    // Apply merchant name action
    if (actions.renameMerchant?.enabled && actions.renameMerchant.value) {
      processedTransaction = {
        ...processedTransaction,
        merchantName: actions.renameMerchant.value,
        transaction: {
          ...processedTransaction.transaction,
          merchantName: actions.renameMerchant.value
        }
      };
    }

    // Apply note action
    if (actions.setNote?.enabled && actions.setNote.value) {
      console.log('Setting note:', actions.setNote.value);
      processedTransaction = {
        ...processedTransaction,
        notes: actions.setNote.value
      };
    }

    // Apply tags action
    if (actions.addTags?.enabled && actions.addTags.value) {
      const newTags = actions.addTags.value.map(tagName => ({
        id: tagName,
        name: tagName
      }));
      
      processedTransaction = {
        ...processedTransaction,
        budgetTags: newTags
      };
    }

    console.log('After applying actions:', {
      transactionId: processedTransaction.transaction.id,
      notes: processedTransaction.notes
    });

    return processedTransaction;
  }

  /**
   * Applies rules to existing transactions in the database
   */
  async applyRulesToExistingTransactions(
    budgetId: string,
    rule: BudgetRule
  ): Promise<ServiceResult<null>> {
    try {
      console.log('Starting to apply rule to existing transactions:', {
        budgetId,
        ruleId: rule.id,
        ruleName: rule.name,
        ruleActions: rule.actions
      });

      // Get all transactions for this budget using the database function
      const { data: transactions, error: fetchError } = await this.supabase
        .rpc('get_budget_transactions_within_range_by_budget_id', {
          p_budget_id: budgetId,
          p_start_date: null,
          p_end_date: null
        });

      if (fetchError) throw fetchError;
      if (!transactions) throw new Error('No transactions found');

      console.log(`Found ${transactions.length} total transactions to process`);

      // Parse transactions using the budget transaction service
      const parsedTransactions = this.budgetTransactionService.parseBudgetTransactions(transactions);
      console.log(`Parsed ${parsedTransactions.length} transactions`);

      // Process each transaction
      const processedTransactions = parsedTransactions
        .map(tx => {
          // Check if transaction matches the rule
          const matches = this.doesTransactionMatchRule(tx, rule);
          console.log('Transaction match check:', {
            transactionId: tx.transaction.id,
            matches,
            conditions: rule.conditions,
            currentCategory: tx.category
          });

          if (!matches) {
            return null;
          }

          // Store original category ID before processing
          const originalCategoryId = tx.category.id;

          // Apply rule actions to matching transactions
          const processed = this.applyRuleActions(tx, rule);
          console.log('Transaction processed:', {
            id: processed.transaction.id,
            originalCategoryId,
            newCategoryId: processed.category.id,
            categoryChanged: originalCategoryId !== processed.category.id
          });
          return processed;
        })
        .filter((tx): tx is BudgetFinAccountTransaction => tx !== null);

      console.log(`Found ${processedTransactions.length} transactions matching rule criteria`);

      // Prepare updates for matching transactions only
      const updates = processedTransactions.map(tx => {
        const update = {
          budget_id: budgetId,
          fin_account_transaction_id: tx.transaction.id,
          svend_category_id: tx.category.id,
          merchant_name: tx.transaction.merchantName,
          payee: tx.transaction.payee,
          notes: tx.notes,
          tag_ids: tx.budgetTags.map(tag => tag.id)
        };
        console.log('Preparing update:', {
          ...update,
          categoryChanged: tx.category.id !== tx.transaction.svendCategoryId
        });
        return update;
      });

      // Update each matching transaction individually
      for (const update of updates) {
        console.log('Updating transaction:', {
          transactionId: update.fin_account_transaction_id,
          categoryId: update.svend_category_id,
          merchantName: update.merchant_name,
          payee: update.payee,
          notes: update.notes,
          tagIds: update.tag_ids
        });

        // Update the budget_fin_account_transactions table
        const { error: budgetTxError } = await this.supabase
          .from('budget_fin_account_transactions')
          .update({
            svend_category_id: update.svend_category_id,
            merchant_name: update.merchant_name,
            payee: update.payee,
            notes: update.notes,
            tag_ids: update.tag_ids
          })
          .eq('budget_id', update.budget_id)
          .eq('fin_account_transaction_id', update.fin_account_transaction_id);

        if (budgetTxError) {
          console.error(`Error updating budget_fin_account_transaction ${update.fin_account_transaction_id}:`, budgetTxError);
          throw budgetTxError;
        }

        // Verify the update
        const { data: verifyData, error: verifyError } = await this.supabase
          .from('budget_fin_account_transactions')
          .select('*')
          .eq('budget_id', update.budget_id)
          .eq('fin_account_transaction_id', update.fin_account_transaction_id)
          .single();

        if (verifyError) {
          console.error(`Error verifying update for transaction ${update.fin_account_transaction_id}:`, verifyError);
        } else {
          console.log('Update verified:', {
            transactionId: update.fin_account_transaction_id,
            updatedCategoryId: verifyData.svend_category_id,
            expectedCategoryId: update.svend_category_id
          });
        }
      }

      return { data: null, error: null };
    } catch (error: any) {
      console.error('Error applying rules to existing transactions:', error);
      return { data: null, error: error.message };
    }
  }

  /**
   * Fetches active rules for a budget and applies them to transactions
   * @param budgetId The budget ID to fetch rules for
   * @param transactions The transactions to apply rules to
   * @returns The transactions with rules applied
   */
  async fetchAndApplyRules(
    budgetId: string,
    transactions: BudgetFinAccountTransaction[]
  ): Promise<BudgetFinAccountTransaction[]> {
    try {
      // Get active rules for this budget
      const { data: rules, error: fetchError } = await this.supabase
        .from('budget_rules')
        .select('*')
        .eq('budget_id', budgetId)
        .eq('is_active', true);

      if (fetchError) {
        console.error('Error fetching rules:', fetchError);
        return transactions;
      }

      if (!rules || rules.length === 0) {
        return transactions;
      }

      // Parse rules
      const parsedRules = rules.map(rule => ({
        id: rule.id,
        budgetId: rule.budget_id,
        name: rule.name,
        isActive: rule.is_active,
        conditions: rule.conditions as BudgetRule['conditions'],
        actions: rule.actions as BudgetRule['actions'],
        createdAt: rule.created_at,
        updatedAt: rule.updated_at
      }));

      // Apply rules to transactions
      return this.applyRulesToTransactions(transactions, parsedRules, budgetId);
    } catch (error) {
      console.error('Error in fetchAndApplyRules:', error);
      return transactions;
    }
  }

  async reorderRule(ruleId: string, newOrder: number): Promise<ServiceResult<null>> {
    try {
      const { error } = await this.supabase
        .from('budget_rules')
        .update({ order: newOrder })
        .eq('id', ruleId);

      if (error) throw error;
      return { data: null, error: null };
    } catch (error: any) {
      console.error('Error reordering rule:', error);
      return { data: null, error: error.message };
    }
  }
}

/**
 * Creates an instance of the RulesService.
 * @param supabaseClient - The Supabase client instance
 * @param transactionService - The transaction service instance
 * @returns An instance of RulesService.
 */
export function createRulesService(
  supabaseClient: SupabaseClient,
  transactionService: ITransactionService
): IRulesService {
  const service = new RulesService(supabaseClient, transactionService);
  if (transactionService instanceof TransactionService) {
    transactionService.setRulesService(service);
  }
  return service;
}

export interface IRulesService {
  createRule: (input: RuleInput) => Promise<ServiceResult<BudgetRule>>;
  updateRule: (id: string, input: Partial<RuleInput>) => Promise<ServiceResult<BudgetRule>>;
  deleteRule: (id: string) => Promise<ServiceResult<null>>;
  getBudgetRules: (budgetId: string) => Promise<ServiceResult<BudgetRule[]>>;
  updateRuleOrder: (budgetId: string, ruleOrders: string[]) => Promise<ServiceResult<null>>;
  applyRulesToTransactions: (
    transactions: BudgetFinAccountTransaction[],
    rules: BudgetRule[],
    budgetId: string
  ) => Promise<BudgetFinAccountTransaction[]>;
  applyRulesToExistingTransactions: (
    budgetId: string,
    rule: BudgetRule
  ) => Promise<ServiceResult<null>>;
  fetchAndApplyRules: (
    budgetId: string,
    transactions: BudgetFinAccountTransaction[]
  ) => Promise<BudgetFinAccountTransaction[]>;
  reorderRule: (ruleId: string, newOrder: number) => Promise<ServiceResult<null>>;
} 