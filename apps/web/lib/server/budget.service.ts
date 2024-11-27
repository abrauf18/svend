import { CategoryGroup, FinAccount, FinAccountTransaction } from '../model/fin.types';
import { Database } from '../database.types';
import {
  Budget,
  BudgetGoal,
  BudgetGoalMonthlyTracking,
  BudgetGoalRecommendations,
  BudgetGoalSpendingRecommendation,
  BudgetGoalSpendingTrackingsByMonth,
  BudgetSpendingCategoryGroupRecommendation,
  BudgetSpendingRecommendations,
  BudgetSpendingTrackingsByMonth,
  BudgetFinAccountTransaction,
  BudgetFinAccountTransactionTag
} from '../model/budget.types';
import { createCategoryService, ICategoryService } from './category.service';
import { SupabaseClient } from '@supabase/supabase-js';
import { Configuration, PlaidApi, TransactionsSyncRequest } from 'plaid';

/**
 * @name BudgetService
 * @description Service for budget-related operations
 */
class BudgetService {
  private categoryService: ICategoryService;
  private supabase: SupabaseClient<Database>;

  constructor(
    supabaseClient: SupabaseClient
  ) {
    this.supabase = supabaseClient;
    // Use provided categoryService or create new one
    this.categoryService = createCategoryService(supabaseClient);
  }

  /**
   * @name saveBudgetTransactions
   * @description Saves budget transactions to the database
   */
  async saveBudgetTransactions(transactions: BudgetFinAccountTransaction[], budgetId: string): Promise<ServiceResult<null>> {
    const BATCH_SIZE = 100;

    try {
      for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const batch = transactions.slice(i, i + BATCH_SIZE);


        for (const budgetTransaction of batch) {
          const { data, error } = await this.supabase
            .rpc('create_budget_fin_account_transaction', {
              p_budget_id: budgetId,
              p_budget_fin_account_id: budgetTransaction.budgetFinAccountId!,
              p_amount: budgetTransaction.transaction.amount,
              p_date: budgetTransaction.transaction.date,
              p_svend_category_id: budgetTransaction.categoryId!,
              p_merchant_name: budgetTransaction.transaction.merchantName || '',
              p_payee: budgetTransaction.transaction.payee || '',
              p_iso_currency_code: budgetTransaction.transaction.isoCurrencyCode || 'USD',
              p_plaid_category_detailed: budgetTransaction.transaction.plaidDetailedCategory,
              p_plaid_category_confidence: budgetTransaction.transaction.plaidCategoryConfidence,
              p_raw_data: budgetTransaction.transaction.rawData || null
            });

          if (error) {
            console.error(`Error inserting transaction:`, error);

            // Debug log
            console.error('Failed transaction params:', {
              budgetId,
              budgetFinAccountId: budgetTransaction.budgetFinAccountId,
              amount: budgetTransaction.transaction.amount,
              date: budgetTransaction.transaction.date,
              categoryId: budgetTransaction.categoryId,
              merchantName: budgetTransaction.transaction.merchantName,
              payee: budgetTransaction.transaction.payee,
              isoCurrencyCode: budgetTransaction.transaction.isoCurrencyCode,
              plaidCategory: budgetTransaction.transaction.plaidDetailedCategory,
              plaidConfidence: budgetTransaction.transaction.plaidCategoryConfidence,
            });

            return { data: null, error: `Failed to persist transaction: ${error.message}` };
          }
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

  /**
   * @name saveTransactions
   * @description Saves transactions to the database
   */
  async saveTransactions(transactions: BudgetFinAccountTransaction[]) {
    const BATCH_SIZE = 100;

    try {
      for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const batch = transactions.slice(i, i + BATCH_SIZE);
        const transactionsToInsert = batch.map((budgetTransaction) => ({
          plaid_account_id: budgetTransaction.transaction.plaidAccountId,
          amount: budgetTransaction.transaction.amount,
          iso_currency_code: budgetTransaction.transaction.isoCurrencyCode,
          plaid_category_detailed: budgetTransaction.transaction.plaidDetailedCategory,
          plaid_category_confidence: budgetTransaction.transaction.plaidCategoryConfidence,
          svend_category_id: budgetTransaction.categoryId as string,
          date: budgetTransaction.transaction.date,
          merchant_name: budgetTransaction.transaction.merchantName,
          payee: budgetTransaction.payee,
          notes: budgetTransaction.notes,
          raw_data: budgetTransaction.transaction.rawData
        }));

        const { error } = await this.supabase
          .from('fin_account_transactions')
          .insert(transactionsToInsert);

        if (error) {
          console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, error);
          return `Failed to persist transactions batch ${i / BATCH_SIZE + 1}: ${error.message}`;
        }

        // Add a small delay between batches to prevent overwhelming the database
        if (i + BATCH_SIZE < transactions.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      return null; // success
    } catch (error: any) {
      console.error('Error in persistTransactions:', error);
      return `Failed to persist transactions: ${error.message}`;
    }
  }

  /**
   * @name createGoalTrackings
   * @description Creates goal tracking data for a budget goal
   */
  createGoalTrackings(goal: BudgetGoal, trackingStartingBalance: number): ServiceResult<BudgetGoalSpendingTrackingsByMonth> {
    const currentDate = new Date();
    const endDate = new Date(goal.targetDate);

    if (endDate <= currentDate) {
      return { data: null, error: 'end date not in the future' };
    }

    // Extract the target day of month from the goal's target date
    const targetDayOfMonth = endDate.getDate();

    // Determine start date based on if target day has passed this month
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    if (currentDate.getDate() >= targetDayOfMonth) {
      // Target day already passed this month, start from next month
      startDate.setMonth(startDate.getMonth() + 1);
    }

    // Get the allocation dates
    const allocationDates: Date[] = [];

    while (startDate < endDate) {
      // Create date for this month's allocation
      const allocationDate = new Date(startDate);

      // Get last day of current month
      const lastDayOfMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();

      // Set the day, adjusting if target day exceeds month length
      allocationDate.setDate(Math.min(targetDayOfMonth, lastDayOfMonth));

      allocationDates.push(new Date(allocationDate));
      startDate.setMonth(startDate.getMonth() + 1);
    }

    const baseMonthlyAmount = Math.round((goal.amount / allocationDates.length) * 100) / 100;

    const goalTrackings: Record<string, BudgetGoalMonthlyTracking> = {};

    allocationDates.forEach((allocationDate, index) => {
      const monthKey = allocationDate.toISOString().substring(0, 7);
      goalTrackings[monthKey] = {
        month: monthKey,
        startingBalance: trackingStartingBalance,
        allocations: {
          [allocationDate.toISOString().substring(0, 10)]: {
            dateTarget: allocationDate.toISOString().split('T')[0]!,
            amountTarget: baseMonthlyAmount
          }
        }
      };
    });

    return { data: goalTrackings, error: null };
  }

  /**
   * @name saveBudgetGoalWithTracking
   * @description Saves a budget goal with tracking data
   */
  async saveBudgetGoalWithTracking(goal: BudgetGoal, trackingStartingBalance: number): Promise<ServiceResult<BudgetGoal>> {
    const goalTrackings = this.createGoalTrackings(goal, trackingStartingBalance);

    // Upsert the goal and return the full object
    const { data, error } = await this.supabase
      .from('budget_goals')
      .upsert({
        id: goal.id, // Will be undefined for new goals
        budget_id: goal.budgetId,
        type: goal.type,
        name: goal.name,
        amount: goal.amount,
        fin_account_id: goal.budgetFinAccountId,
        description: goal.description,
        target_date: goal.targetDate,
        debt_type: goal.debtType as Database['public']['Enums']['debt_type_enum'],
        debt_payment_component: goal.debtPaymentComponent as Database['public']['Enums']['budget_goal_debt_payment_component_enum'],
        debt_interest_rate: goal.debtInterestRate,
        spending_tracking: goalTrackings,
        spending_recommendations: {}
      })
      .select('*');

    if (error) {
      console.error(error);
      const isForeignKeyViolation = error.message.includes('violates foreign key constraint "budget_goals_fin_account_id_fkey"');

      if (isForeignKeyViolation) {
        return { data: null, error: 'invalid budget financial account id' };
      }

      return { data: null, error: 'unknown error' };
    }

    return { data: goal, error: null };
  }

  /**
   * @name getBudgetGoals
   * @description Gets budget goals for a budget
   */
  async getBudgetGoals(budgetId: string): Promise<Database['public']['Tables']['budget_goals']['Row'][]> {
    const { data: dbBudgetGoals, error } = await this.supabase
      .from('budget_goals')
      .select(`
        *,
        budget_fin_accounts (
          plaid_account:plaid_accounts (
            balance_current
          ),
          manual_fin_account:manual_fin_accounts (
            balance_current
          )
        )
      `)
      .eq('budget_id', budgetId);

    if (error) {
      console.error('Error fetching budget goals:', error);
      return [];
    }

    // Transform the results to include the balance from either plaid or manual account
    return dbBudgetGoals.map(goal => ({
      ...goal,
      fin_account_balance:
        goal.budget_fin_accounts?.plaid_account?.balance_current ??
        goal.budget_fin_accounts?.manual_fin_account?.balance_current ??
        0
    }));
  }

  /**
   * @name getPlaidConnectionItemSummaries
   * @description Gets Plaid connection item summaries for a budget
   */
  async getPlaidConnectionItemSummaries(budgetId: string): Promise<ServiceResult<PlaidConnectionItemSummary[]>> {
    try {
      const { data: items, error } = await this.supabase
        .from('plaid_connection_items')
        .select(`
          *,
          plaid_accounts (
            budget_fin_accounts (
              budget_id
            )
          )
        `)
        .eq('plaid_accounts.budget_fin_accounts.budget_id', budgetId);

      if (error) {
        return { data: null, error: error.message };
      }

      const itemSummaries = items.map(item => ({
        svendItemId: item.id,
        accessToken: item.access_token,
        nextCursor: item.next_cursor!
      }));

      return { data: itemSummaries, error: null };
    } catch (error: any) {
      return { data: null, error: error.message };
    }
  }

  /**
   * @name hasPermission
   * @description Check if the user has permission for the account.
   */
  async hasPermission(params: {
    budgetId: string;
    userId: string;
    permission: Database['public']['Enums']['app_permissions'];
  }): Promise<ServiceResult<boolean>> {
    const { data, error } = await this.supabase.rpc('has_budget_permission', {
      budget_id: params.budgetId,
      user_id: params.userId,
      permission_name: params.permission,
    });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  }

  /**
   * @name hasLinkedFinAccounts
   * @description Checks if the budget has any linked financial accounts
   */
  async hasLinkedFinAccounts(budgetId: string): Promise<ServiceResult<null>> {
    const { data: finAccounts, error: finAccountsError } = await this.supabase
      .from('budget_fin_accounts')
      .select('*')
      .eq('budget_id', budgetId)
      .limit(1);

    if (finAccountsError) {
      return {
        data: null,
        error: `Error fetching linked accounts: ${finAccountsError.message}`
      };
    }

    if (!finAccounts || finAccounts.length === 0) {
      return { data: null, error: `No linked financial accounts found for budget: ${budgetId}` };
    }

    return { data: null, error: null };
  }

  /**
   * @name validateBudgetReadyForOnboardingUserSetup
   * @description Validates if the budget is ready for onboarding user setup
   */
  async validateBudgetReadyForOnboardingUserSetup(budgetId: string): Promise<ServiceResult<null>> {
    // Validate spending recommendations and tracking are present
    const { data: budget, error: budgetError } = await this.supabase
      .from('budgets')
      .select('spending_recommendations, spending_tracking')
      .eq('id', budgetId)
      .single();

    if (budgetError) {
      console.error('Error fetching budget:', budgetError);
      return { data: null, error: budgetError.message };
    }

    if (!budget?.spending_recommendations || !budget?.spending_tracking) {
      return {
        data: null,
        error: 'budget not ready for onboarding setup > missing spending recommendations or tracking'
      };
    }

    return { data: null, error: null };
  }

  /**
   * @name parseBudget
   * @description Parses and validates raw budget data into a strongly typed Budget object
   */
  parseBudget(
    rawGetBudgetResults: Database['public']['Functions']['get_budget_by_team_account_slug']['Returns'][number]
  ): Budget | null {
    try {
      // Validate required fields
      if (!rawGetBudgetResults.id ||
        !rawGetBudgetResults.team_account_id ||
        !rawGetBudgetResults.budget_type ||
        !rawGetBudgetResults.spending_tracking ||
        !rawGetBudgetResults.spending_recommendations ||
        !rawGetBudgetResults.current_onboarding_step) {
        console.error('Missing required fields in budget results:', rawGetBudgetResults);
        return null;
      }

      // Validate budget type
      if (!['personal', 'business'].includes(rawGetBudgetResults.budget_type)) {
        console.error('Invalid budget type:', rawGetBudgetResults.budget_type);
        return null;
      }

      // Parse category spending JSON
      let categoryGroupSpending: BudgetSpendingTrackingsByMonth;
      try {
        categoryGroupSpending = rawGetBudgetResults.spending_tracking as BudgetSpendingTrackingsByMonth;
      } catch (error) {
        console.error('Error parsing category spending:', error);
        return null;
      }

      // Parse recommended category spending JSON
      let recommendedCategoryGroupSpending: BudgetSpendingRecommendations;
      try {
        recommendedCategoryGroupSpending = rawGetBudgetResults.spending_recommendations as BudgetSpendingRecommendations;
      } catch (error) {
        console.error('Error parsing recommended category spending:', error);
        return null;
      }

      // Parse linked accounts from the JSON array
      let linkedFinAccounts: FinAccount[] = [];
      try {
        if (rawGetBudgetResults.linked_accounts) {
          linkedFinAccounts = (rawGetBudgetResults.linked_accounts as any[]).map(account => ({
            id: account.id,
            source: account.source,
            budgetFinAccountId: account.budgetFinAccountId,
            name: account.name,
            mask: account.mask || '',
            officialName: account.officialName || '',
            balance: account.balance || 0
          }));
        }
      } catch (error) {
        console.error('Error parsing linked accounts:', error);
        return null;
      }

      // Parse goals from the JSON array
      let goals: BudgetGoal[] = [];
      try {
        if (rawGetBudgetResults.goals) {
          goals = (rawGetBudgetResults.goals as any[])
            .map(goal => this.parseBudgetGoal(goal))
            .filter((goal): goal is BudgetGoal => goal !== null);
        }
      } catch (error) {
        console.error('Error parsing goals:', error);
        return null;
      }

      // Return the complete budget object
      return {
        id: rawGetBudgetResults.id,
        budgetType: rawGetBudgetResults.budget_type,
        spendingTracking: categoryGroupSpending,
        spendingRecommendations: recommendedCategoryGroupSpending,
        goals,
        onboardingStep: rawGetBudgetResults.current_onboarding_step,
        linkedFinAccounts,
      };

    } catch (error) {
      console.error('Error parsing budget:', error);
      return null;
    }
  }

  /**
   * Parses and validates a raw budget goal database row into a strongly typed BudgetGoal object
   * @param raw The raw budget goal database row to parse
   * @returns A validated BudgetGoal object if parsing succeeds, null if validation fails
   * 
   * Performs the following validations:
   * - Checks all required fields are present
   * - Validates goal type is one of: debt, savings, or investment
   * - For debt goals, validates debt-specific fields exist
   * - For non-debt goals, validates debt fields are null
   * - Validates amount is positive
   * - Validates target date is a valid date
   */
  parseBudgetGoal(raw: Database['public']['Tables']['budget_goals']['Row'], budgetFinAccountBalance?: number): BudgetGoal | null {
    try {
      // Validate required fields exist
      if (!raw.id || !raw.budget_id || !raw.type || !raw.amount ||
        !raw.target_date || !raw.fin_account_id || !raw.name || !raw.spending_tracking || !raw.spending_recommendations) {
        return null;
      }

      // Validate goal type
      const validTypes: Database['public']['Enums']['budget_goal_type_enum'][] = ['debt', 'savings', 'investment'];
      if (!validTypes.includes(raw.type)) {
        return null;
      }

      // Validate debt-specific fields when type is debt
      if (raw.type === 'debt') {
        if (raw.debt_interest_rate === null ||
          !raw.debt_payment_component ||
          !raw.debt_type) {
          console.error('Missing required debt fields for debt goal');
          return null;
        }
      } else {
        if (raw.debt_interest_rate !== null ||
          raw.debt_payment_component !== null ||
          raw.debt_type !== null) {
          console.error('Unexpected debt fields for non-debt goal');
          return null;
        }
      }

      // Validate amount is a positive number
      if (raw.amount < 0) {
        return null;
      }

      // Validate dates
      const targetDate = new Date(raw.target_date);
      if (isNaN(targetDate.getTime())) {
        return null;
      }

      // return the goal
      return {
        id: raw.id,
        budgetId: raw.budget_id,
        type: raw.type,
        name: raw.name,
        amount: raw.amount,
        targetDate: raw.target_date,
        budgetFinAccountId: raw.fin_account_id,
        budgetFinAccountBalance: budgetFinAccountBalance ?? undefined,
        debtInterestRate: raw.debt_interest_rate ?? undefined,
        debtPaymentComponent: raw.debt_payment_component ?? undefined,
        debtType: raw.debt_type ?? undefined,
        createdAt: raw.created_at,
        spendingTracking: raw.spending_tracking as any,
        spendingRecommendations: raw.spending_recommendations as any,
        description: raw.description ?? undefined,
      } as BudgetGoal;
    } catch (error) {
      console.error('Error parsing budget goal:', error);
      return null;
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
              date: budgetTransaction.date,
              amount: budgetTransaction.amount,
              merchantName: budgetTransaction.merchant_name,
              payee: budgetTransaction.payee ?? undefined,
              isoCurrencyCode: budgetTransaction.iso_currency_code ?? undefined,
            },
            budgetFinAccountId: budgetTransaction.budget_fin_account_id ?? undefined,

            // Category information
            categoryGroupId: budgetTransaction.svend_category_group_id ?? undefined,
            categoryGroup: budgetTransaction.svend_category_group ?? undefined,
            categoryId: budgetTransaction.svend_category_id ?? undefined,
            category: budgetTransaction.svend_category ?? undefined,

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
   * Parses and validates raw budget tags into strongly typed FinAccountTransactionBudgetTag objects
   * @param raw The raw budget tags from the get_budget_tags_by_team_account_slug function
   * @returns Array of validated FinAccountTransactionBudgetTag objects
   */
  parseBudgetTags(raw: Database['public']['Functions']['get_budget_tags_by_team_account_slug']['Returns']): BudgetFinAccountTransactionTag[] {
    return raw.map((tag: any) => ({
      id: tag.id,
      budgetId: tag.budget_id,
      name: tag.name,
      createdAt: tag.created_at,
    }));
  }

  /**
   * Updates budget recommendations in the database
   * @param budgetId The ID of the budget to update
   * @param recommendations The recommendations to store
   */
  async updateSpending(
    budgetId: string,
    recommendations: BudgetSpendingRecommendations,
    tracking: BudgetSpendingTrackingsByMonth
  ): Promise<ServiceResult<null>> {
    try {
      const { error: updateError } = await this.supabase
        .from('budgets')
        .update({
          spending_recommendations: recommendations,
          spending_tracking: tracking
        })
        .eq('id', budgetId);

      if (updateError) {
        return { data: null, error: updateError.message };
      }

      return { data: null, error: null };
    } catch (error: any) {
      return { data: null, error: error.message };
    }
  }

  /**
   * Updates budget recommendations in the database
   * @param budgetId The ID of the budget to update
   * @param months The months to recalculate (format: YYYY-MM)
   */
  /**
   * Updates budget recommendations in the database
   * @param budgetId The ID of the budget to update
   * @param months The months to recalculate (format: YYYY-MM)
   */
  async updateRecalculateSpending(
    budgetId: string,
    months: string[]
  ): Promise<ServiceResult<null>> {
    try {
      // Validate month format and values
      const currentYear = new Date().getFullYear();
      const validMonthRegex = /^\d{4}-(?:0[1-9]|1[0-2])$/;

      for (const month of months) {
        // Check format
        if (!validMonthRegex.test(month)) {
          return {
            data: null,
            error: `Invalid month format: ${month}. Expected format: YYYY-MM`
          };
        }

        // Extract and validate year
        const year = parseInt(month.substring(0, 4));
        if (Math.abs(year - currentYear) > 100) {
          return {
            data: null,
            error: `Year ${year} is too far from current year`
          };
        }
      }

      // Get current budget tracking
      const { data: dbBudget, error: budgetError } = await this.supabase
        .from('budgets')
        .select('spending_tracking')
        .eq('id', budgetId)
        .single();

      if (budgetError) {
        return { data: null, error: `Failed to fetch budget: ${budgetError.message}` };
      }

      const dbTracking = dbBudget.spending_tracking as BudgetSpendingTrackingsByMonth;

      // Get category groups for the budget
      const categoryService = createCategoryService(this.supabase);
      const categoryGroups = await categoryService.getBudgetCategoryGroups(budgetId);

      // Process each month
      for (const month of months) {
        // Validate month exists in tracking
        if (!dbTracking[month]) {
          console.warn(`budgetService:updateRecalculateSpending: Month ${month} not found in budget tracking - skipping`);
          continue;
        }

        // Fetch transactions for this month
        const { data: dbTransactions, error: txError } = await this.supabase
          .rpc('get_budget_transactions_within_range_by_budget_id', {
            p_budget_id: budgetId,
            p_start_date: `${month}-01`, // Already in YYYY-MM-DD format
            p_end_date: new Date(
              parseInt(month.substring(0, 4)), // year
              parseInt(month.substring(5, 7)), // month (0-based, so next month)
              0  // last day of current month
            ).toISOString().split('T')[0]! // Formats as YYYY-MM-DD
          });

        if (txError) {
          return { data: null, error: `Failed to fetch transactions: ${txError.message}` };
        }

        // Parse transactions into BudgetFinAccountTransaction[]
        const parsedTransactions = this.parseBudgetTransactions(dbTransactions);

        // Calculate spending tracking for this month
        const { spendingTrackingsByMonth } = this.calculateSpendingTrackings(
          parsedTransactions,
          categoryGroups
        );

        // Update tracking with new month data
        if (spendingTrackingsByMonth[month]) {
          // Round spending tracking values
          Object.values(spendingTrackingsByMonth[month]).forEach(groupTracking => {
            groupTracking.spendingActual = Math.round(groupTracking.spendingActual * 100) / 100;
            groupTracking.spendingTarget = Math.round(groupTracking.spendingTarget * 100) / 100;
            groupTracking.categories.forEach(categoryTracking => {
              categoryTracking.spendingActual = Math.round(categoryTracking.spendingActual * 100) / 100;
              categoryTracking.spendingTarget = Math.round(categoryTracking.spendingTarget * 100) / 100;
            });
          });

          dbTracking[month] = spendingTrackingsByMonth[month];
        }
      }

      // Update budget with recalculated tracking
      const { error: updateError } = await this.supabase
        .from('budgets')
        .update({ spending_tracking: dbTracking })
        .eq('id', budgetId);

      if (updateError) {
        return { data: null, error: `Failed to update budget: ${updateError.message}` };
      }

      return { data: null, error: null };
    } catch (error: any) {
      return { data: null, error: error.message };
    }
  }

  /**
   * Updates goal spending recommendations and tracking data for multiple goals
   * @param budgetId The ID of the budget containing the goals
   * @param goalTrackings The tracking data to update
   */
  async updateGoalSpending(
    budgetId: string,
    goalRecommendations: BudgetGoalRecommendations,
    // The key is the goal id
    goalTrackings: Record<string, BudgetGoalSpendingTrackingsByMonth>
  ): Promise<ServiceResult<null>> {
    try {
      // Create an array of update promises for all goals
      const updatePromises = Object.entries(goalTrackings).map(([goalId, trackingData]) => {
        // Get recommendations for this goal
        const balancedRec = goalRecommendations.balanced[goalId];
        const conservativeRec = goalRecommendations.conservative[goalId];
        const relaxedRec = goalRecommendations.relaxed[goalId];

        // Combine tracking and recommendations into a single update
        const goalUpdate = {
          spending_tracking: trackingData,
          spending_recommendations: {
            balanced: balancedRec,
            conservative: conservativeRec,
            relaxed: relaxedRec
          }
        };

        return this.supabase
          .from('budget_goals')
          .update(goalUpdate)
          .eq('id', goalId)
          .eq('budget_id', budgetId);
      });

      // Execute all updates concurrently
      const results = await Promise.all(updatePromises);

      // Check for any errors in the results
      const errors = results
        .map(result => result.error)
        .filter(error => error !== null);

      if (errors.length > 0) {
        return {
          data: null,
          error: `Failed to update goal spending: ${errors.map(e => e?.message).join(', ')}`
        };
      }

      return { data: null, error: null };
    } catch (error: any) {
      return { data: null, error: error.message };
    }
  }

  /**
   * 1. Validates prerequisites for onboarding analysis
   * Ensures budget has linked accounts and is ready for analysis
   * @param budgetId - The ID of the budget to validate
   * @throws Error if prerequisites are not met
   */
  private async onboardingAnalysisValidateOnboardingPrerequisites(budgetId: string): Promise<void> {
    // Check for linked accounts
    const { error: linkedAccountsError } = await this.hasLinkedFinAccounts(budgetId);
    if (linkedAccountsError) {
      throw new Error(`SERVER_ERROR:[hasLinkedFinAccounts] ${linkedAccountsError}`);
    }

    // Validate budget is ready for analysis
    const { error: budgetReadyError } = await this.validateBudgetReadyForOnboardingUserSetup(budgetId);
    if (budgetReadyError) {
      throw new Error(`SERVER_ERROR:[validateBudgetReady] ${budgetReadyError}`);
    }
  }

  /**
   * 2. Collects transactions from all Plaid connections
   * Fetches existing transactions and syncs new ones from Plaid
   * @param budgetId - The ID of the budget to collect transactions for
   * @param plaidItems - Array of Plaid connection items to process
   * @param plaidClient - Initialized Plaid API client
   * @returns Collection of transactions and cursor data
   */
  private async onboardingAnalysisCollectTransactions(
    budgetId: string,
    plaidItems: PlaidConnectionItemSummary[],
    plaidClient: PlaidApi
  ): Promise<OnboardingAnalysisTransactionCollection> {
    const result: OnboardingAnalysisTransactionCollection = {
      allTransactions: [],
      newTransactions: [],
      itemCursors: {}
    };

    // Process each Plaid connection item
    for (const item of plaidItems) {
      await this.onboardingAnalysisCollectItemTransactions(
        item,
        budgetId,
        plaidClient,
        result
      );
    }

    return result;
  }

  /**
   * 2.1 Collects transactions for a single Plaid connection item
   * Part of the transaction collection process
   * @param item - The Plaid connection item to process
   * @param budgetId - The ID of the budget
   * @param plaidClient - Initialized Plaid API client
   * @param result - Collection to store transaction results
   */
  private async onboardingAnalysisCollectItemTransactions(
    item: PlaidConnectionItemSummary,
    budgetId: string,
    plaidClient: PlaidApi,
    result: OnboardingAnalysisTransactionCollection
  ): Promise<void> {
    try {
      // 1. Fetch existing transactions
      const existingTransactions = await this.onboardingAnalysisFetchExistingTransactions(item.svendItemId, budgetId);

      // 2. Get Plaid account mappings
      const plaidAccounts = this.onboardingAnalysisGetPlaidAccountMappings(existingTransactions);

      // 3. Process existing transactions
      this.onboardingAnalysisProcessExistingTransactions(existingTransactions, result);

      // 4. Sync new transactions from Plaid
      await this.onboardingAnalysisSyncNewTransactions(item, plaidClient, plaidAccounts, result);

    } catch (error: any) {
      throw new Error(
        `Failed to process Plaid item ${item.svendItemId}: ${error.message}`
      );
    }
  }

  /**
   * 2.2 Fetches existing transactions from the database
   * Part of the transaction collection process
   * @param itemId - The ID of the Plaid connection item
   * @param budgetId - The ID of the budget
   * @returns Array of existing transactions from the database
   */
  private async onboardingAnalysisFetchExistingTransactions(itemId: string, budgetId: string) {
    const { data: transactions, error } = await this.supabase
      .from('plaid_accounts')
      .select(`
        id,
        plaid_account_id,
        fin_account_transactions (*),
        budget_fin_accounts!left (id)
      `)
      .eq('plaid_conn_item_id', itemId)
      .eq('budget_fin_accounts.budget_id', budgetId);

    if (error) {
      throw new Error(`Failed to fetch existing transactions: ${error.message}`);
    }

    return transactions;
  }

  /**
   * 2.3 Creates Plaid account to budget account mappings
   * Part of the transaction collection process
   * @param existingTransactions - Array of transactions from database
   * @returns Array of account mappings
   */
  private onboardingAnalysisGetPlaidAccountMappings(existingTransactions: any[]) {
    return existingTransactions.map(account => ({
      id: account.id,
      plaid_account_id: account.plaid_account_id,
      budget_fin_account_id: account.budget_fin_accounts[0]?.id
    }));
  }

  /**
   * 2.4 Processes existing transactions into the result object
   * Part of the transaction collection process
   * @param existingTransactions - Array of transactions from database
   * @param result - Collection to store processed transactions
   */
  private onboardingAnalysisProcessExistingTransactions(
    existingTransactions: any[],
    result: OnboardingAnalysisTransactionCollection
  ) {
    const transactions = existingTransactions
      .flatMap(account => account.fin_account_transactions.map((transaction: any) => ({
        ...transaction,
        budgetFinAccountId: account.budget_fin_accounts[0]?.id
      })))
      .filter(Boolean);

    for (const transaction of transactions) {
      if (transaction.plaid_category_detailed) {
        result.allTransactions.push({
          transaction: {
            id: transaction.id,
            date: transaction.date,
            amount: transaction.amount,
            plaidDetailedCategory: transaction.plaid_category_detailed,
          } as FinAccountTransaction,
          budgetFinAccountId: transaction.budgetFinAccountId,
        } as BudgetFinAccountTransaction);
      }
    }
  }

  /**
   * 2.5 Syncs new transactions from Plaid
   * Final step of the transaction collection process
   */
  private async onboardingAnalysisSyncNewTransactions(
    item: PlaidConnectionItemSummary,
    plaidClient: PlaidApi,
    plaidAccounts: any[],
    result: OnboardingAnalysisTransactionCollection
  ) {
    let nextCursor = item.nextCursor;
    let hasMore = true;

    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: item.accessToken as string,
        cursor: nextCursor,
      } as TransactionsSyncRequest);

      for (const transaction of response.data.added) {
        const plaidCategory = transaction.personal_finance_category?.detailed;
        if (plaidCategory) {
          const newTransaction = this.onboardingAnalysisCreateTransactionFromPlaid(
            transaction,
            plaidCategory,
            plaidAccounts
          );

          result.newTransactions.push(newTransaction);
          result.allTransactions.push(newTransaction);
        }
      }

      hasMore = response.data.has_more;
      nextCursor = response.data.next_cursor;
    }

    result.itemCursors[item.svendItemId] = nextCursor;
  }

  /**
   * 2.6 Creates a FinAccountTransaction from Plaid transaction data
   * Helper for transaction sync process
   */
  private onboardingAnalysisCreateTransactionFromPlaid(
    transaction: any,
    plaidCategory: string,
    plaidAccounts: any[]
  ): BudgetFinAccountTransaction {
    const matchingAccount = plaidAccounts?.find(
      account => account.plaid_account_id === transaction.account_id
    );

    return {
      transaction: {
        id: transaction.id,
        date: transaction.date,
        amount: transaction.amount,
        plaidDetailedCategory: plaidCategory,
        plaidCategoryConfidence: transaction?.personal_finance_category?.confidence_level,
        plaidAccountId: matchingAccount?.id,
        merchantName: transaction.merchant_name ?? '',
        payee: transaction.payment_meta?.payee ?? '',
        isoCurrencyCode: transaction.iso_currency_code,
        rawData: transaction,
      } as FinAccountTransaction,
      budgetFinAccountId: matchingAccount?.budget_fin_account_id,
    } as BudgetFinAccountTransaction;
  }

  /**
   * 3. Maps Plaid categories to Svend categories and processes transactions
   */
  /**
   * 3. Maps Plaid categories to Svend categories and processes transactions
   */
  private async onboardingAnalysisProcessCategories(
    transactionData: OnboardingAnalysisTransactionCollection
  ): Promise<{ transactionData?: OnboardingAnalysisTransactionCollection, error?: string }> {
    try {
      const categoryService = createCategoryService(this.supabase);

      const uniquePlaidCategories = [...new Set(transactionData.allTransactions
        .map(t => t.transaction.plaidDetailedCategory)
        .filter((cat): cat is string => !!cat)
      )];

      const svendCategories = await categoryService.mapPlaidCategoriesToSvendCategories(
        uniquePlaidCategories
      );
      if (!svendCategories) {
        throw new Error('Category mapping returned null or undefined');
      }

      const updatedTransactions = transactionData.allTransactions.map(budgetTransaction => {
        const plaidCategory = budgetTransaction.transaction.plaidDetailedCategory;
        if (!plaidCategory) {
          console.warn('Transaction missing Plaid category:', budgetTransaction);
          return budgetTransaction;
        }

        // Get the mapped category using the full Plaid category key
        const mappedCategory = svendCategories[plaidCategory];
        if (!mappedCategory) {
          console.warn(`No mapping found for Plaid category: ${plaidCategory}`);
          return budgetTransaction;
        }

        return {
          ...budgetTransaction,
          categoryId: mappedCategory.id,
          category: mappedCategory.name,
        } as BudgetFinAccountTransaction;
      });

      // Sort transactions by date
      updatedTransactions.sort((a, b) =>
        new Date(a.transaction.date).getTime() - new Date(b.transaction.date).getTime()
      );
      
      const updatedNewTransactions = transactionData.newTransactions.map(budgetTransaction => {
        const plaidCategory = budgetTransaction.transaction.plaidDetailedCategory;
        if (!plaidCategory) {
          console.warn('Transaction missing Plaid category:', budgetTransaction);
          return budgetTransaction;
        }
        
        // Get the mapped category using the full Plaid category key
        const mappedCategory = svendCategories[plaidCategory];
        if (!mappedCategory) {
          console.warn(`No mapping found for Plaid category: ${plaidCategory}`);
          return budgetTransaction;
        }
        
        return {
          ...budgetTransaction,
          categoryId: mappedCategory.id,
          category: mappedCategory.name,
        } as BudgetFinAccountTransaction;
      });

      // Sort transactions by date
      updatedNewTransactions.sort((a, b) =>
        new Date(a.transaction.date).getTime() - new Date(b.transaction.date).getTime()
      );

      transactionData.allTransactions = updatedTransactions;
      transactionData.newTransactions = updatedNewTransactions;

      return { transactionData };
    } catch (error: any) {
      console.error('Error in processCategories:', error);
      return {
        error: `SERVER_ERROR:[onboardingAnalysis.processCategories] ${error.message}`
      };
    }
  }

  /**
   * 4. Analyzes spending patterns from categorized transactions
   */
  private async onboardingAnalysisAnalyzeSpending(
    transactions: BudgetFinAccountTransaction[]
  ): Promise<OnboardingAnalysisSpendingData> {
    try {
      // Initialize monthlyCategorySpending
      const monthlyCategorySpending: Record<string, number> = {};

      // Aggregate transactions by category
      transactions.forEach(budgetTransaction => {
        const plaidCategory = budgetTransaction.transaction.plaidDetailedCategory!;
        if (!budgetTransaction.category) {
          console.warn('Transaction missing mapped category:', {
            date: budgetTransaction.transaction.date,
            amount: budgetTransaction.transaction.amount,
            plaidCategory: budgetTransaction.transaction.plaidDetailedCategory,
            svendCategory: budgetTransaction.category
          });
          return;
        }

        // For income categories, store as negative to represent inflow
        const isIncome = plaidCategory.toLowerCase().includes('income');
        const amount = isIncome ? -Math.abs(budgetTransaction.transaction.amount) : Math.abs(budgetTransaction.transaction.amount);
        monthlyCategorySpending[plaidCategory] = (monthlyCategorySpending[plaidCategory] || 0) + amount;
      });

      // Initialize Income category if it doesn't exist
      if (!monthlyCategorySpending['Income']) {
        monthlyCategorySpending['Income'] = 0;
      }

      // Calculate spending analysis
      const totalIncome = Math.abs(monthlyCategorySpending['Income'] || 0);
      const totalSpending = Object.entries(monthlyCategorySpending)
        .filter(([category]) => !category.toLowerCase().includes('income'))
        .reduce((sum, [_, amount]) => sum + amount, 0);

      const spendingAnalysis = {
        totalIncome,
        totalSpending,
        categoryBreakdown: Object.entries(monthlyCategorySpending).reduce((acc, [category, amount]) => {
          acc[category] = Math.round(amount * 100) / 100; // Round to 2 decimal places
          return acc;
        }, {} as Record<string, number>)
      };

      return {
        monthlyCategorySpending,
        spendingAnalysis
      };

    } catch (error: any) {
      throw new Error(`Failed to analyze spending: ${error.message}`);
    }
  }

  /**
   * 5. Persists analysis data including new transactions and cursor updates
   */
  private async onboardingAnalysisPersistData(
    budgetId: string,
    newTransactions: BudgetFinAccountTransaction[],
    plaidItems: PlaidConnectionItemSummary[],
    itemCursors: Record<string, string>
  ): Promise<void> {
    try {
      // Step 1: Save new transactions
      const { error: saveError } = await this.onboardingAnalysisSaveTransactions(
        newTransactions,
        budgetId
      );
      if (saveError) {
        throw new Error(saveError);
      }

      // Step 2: Update Plaid cursors
      const { error: cursorError } = await this.onboardingAnalysisUpdateCursors(
        plaidItems,
        itemCursors
      );
      if (cursorError) {
        throw new Error(cursorError);
      }

    } catch (error: any) {
      throw new Error(`Failed to persist analysis data: ${error.message}`);
    }
  }

  /**
   * 5.1 Saves new transactions to the database
   * Part of the persistence process
   * @param newTransactions - Array of transactions to save
   * @param budgetId - The ID of the budget
   * @returns Object containing optional error message
   */
  private async onboardingAnalysisSaveTransactions(
    newTransactions: BudgetFinAccountTransaction[],
    budgetId: string
  ): Promise<{ error?: string }> {
    try {
      console.log(`budget service > onboarding analysis > persisting ${newTransactions.length} new transactions..`);
      const { error } = await this.saveBudgetTransactions(newTransactions, budgetId);
      if (error) throw new Error(error);
      return { error: undefined };
    } catch (error: any) {
      return { error: `SERVER_ERROR:[onboardingAnalysis.saveTransactions] ${error.message}` };
    }
  }

  /**
   * 5.2 Updates Plaid cursors in the database
   * Final step of the persistence process
   * @param plaidItems - Array of Plaid connection items
   * @param itemCursors - Record of cursor positions by item ID
   * @returns Object containing optional error message
   */
  private async onboardingAnalysisUpdateCursors(
    plaidItems: PlaidConnectionItemSummary[],
    itemCursors: Record<string, string>
  ): Promise<{ error?: string }> {
    try {
      for (const item of plaidItems) {
        const { error: updateError } = await this.supabase
          .from('plaid_connection_items')
          .update({ next_cursor: itemCursors[item.svendItemId] })
          .eq('id', item.svendItemId);

        if (updateError) {
          throw new Error(`Failed for item ${item.svendItemId}: ${updateError.message}`);
        }
      }
      return { error: undefined };
    } catch (error: any) {
      return { error: `SERVER_ERROR:[onboardingAnalysis.updateCursors] ${error.message}` };
    }
  }

  /**
   * 6. Validates and formats the final analysis results
   * @param results - Raw analysis results to validate
   * @returns ServiceResult containing validated results or error
   */
  private onboardingAnalysisValidateAndFormatResults(
    results: OnboardingRecommendSpendingAndGoalsResult
  ): ServiceResult<OnboardingRecommendSpendingAndGoalsResult> {
    // Validate recommendations
    if (!results.spendingRecommendations || !results.spendingTrackings || !results.goalSpendingRecommendations || !results.goalSpendingTrackings) {
      return {
        data: null,
        error: 'SERVER_ERROR:[onboardingAnalysis.recommendations] Generated recommendations are empty'
      };
    }

    // Format and return the final result
    return {
      data: results,
      error: results.error
    };
  }

  // fetch/persist transactions and analyze spending
  async onboardingAnalysis(
    budgetId: string,
    plaidConnectionItems: PlaidConnectionItemSummary[],
    plaidConfiguration: Configuration
  ): Promise<ServiceResult<OnboardingRecommendSpendingAndGoalsResult>> {
    try {
      // 1. Validation & Setup
      await this.onboardingAnalysisValidateOnboardingPrerequisites(budgetId);
      const plaidClient = new PlaidApi(plaidConfiguration);

      // 2. Transaction Collection
      const transactionData = await this.onboardingAnalysisCollectTransactions(
        budgetId,
        plaidConnectionItems,
        plaidClient
      );

      // 3. Category Processing
      const { error: categoryError } =
        await this.onboardingAnalysisProcessCategories(transactionData);
      if (categoryError) {
        return { data: null, error: categoryError };
      }

      // 4. Spending Analysis
      await this.onboardingAnalysisAnalyzeSpending(
        transactionData.allTransactions
      );

      // 5. Persistence
      await this.onboardingAnalysisPersistData(
        budgetId,
        transactionData.newTransactions,
        plaidConnectionItems,
        transactionData.itemCursors
      );

      // 6. Recommendations Generation
      const validBudgetGoals = (await this.getBudgetGoals(budgetId))
        .map(goal => this.parseBudgetGoal(goal, (goal as any).fin_account_balance))
        .filter((goal): goal is BudgetGoal => goal !== null);
      const categoryGroups = await this.categoryService.getBudgetCategoryGroups(budgetId);

      const recommendationsResult = await this.onboardingRecommendSpendingAndGoals(
        transactionData.allTransactions,
        validBudgetGoals,
        categoryGroups
      );
      if (recommendationsResult.error) {
        return { data: null, error: recommendationsResult.error };
      }

      // 7. Result Validation & Return
      return this.onboardingAnalysisValidateAndFormatResults(recommendationsResult);

    } catch (error: any) {
      console.error('[onboardingAnalysis] Error:', error);
      return {
        data: null,
        error: `SERVER_ERROR:[onboardingAnalysis] ${error.message}`
      };
    }
  }

  /**
   * 1. Applies balanced strategy to spending and goals
   * @param spendingRecommendations - Current spending recommendations by category group
   * @param goalRecommendations - Current goal recommendations
   * @param totalIncome - Total monthly income
   * @param totalNonDiscretionarySpending - Total non-discretionary spending
   * @param totalDiscretionarySpending - Total discretionary spending
   * @param discretionaryCategories - List of categories considered discretionary
   */
  private onboardingRecommendSpendingAndGoalsBalancedStrategy(
    spendingRecommendations: Record<string, BudgetSpendingCategoryGroupRecommendation>,
    goalRecommendations: Record<string, BudgetGoalSpendingRecommendation>,
    totalIncome: number,
    totalNonDiscretionarySpending: number,
    totalDiscretionarySpending: number,
    discretionaryCategories: string[]
  ): void {
    // Calculate total desired spending
    const totalDesiredSpending = totalNonDiscretionarySpending + totalDiscretionarySpending;

    // Calculate deficit if any
    const deficit = Math.max(0, totalDesiredSpending - totalIncome);

    if (deficit > 0) {
      // Calculate total discretionary spending
      const totalDiscretionary = Object.values(spendingRecommendations)
        .reduce((sum, group) =>
          sum + group.categories
            .filter(cat => discretionaryCategories.includes(cat.categoryName))
            .reduce((catSum, cat) => catSum + cat.recommendation, 0)
          , 0);

      // Calculate reduction needed, capped at 50% of discretionary spending
      const maxReduction = totalDiscretionary * 0.5;
      const reductionNeeded = Math.min(maxReduction, deficit);
      const reductionPercent = reductionNeeded / totalDiscretionary;

      // Calculate total reduction to be applied
      const totalReduction = reductionNeeded;
      let appliedReduction = 0;

      // Get all discretionary categories
      const discretionaryCats = Object.values(spendingRecommendations)
        .flatMap(group => group.categories.filter(cat => discretionaryCategories.includes(cat.categoryName)));

      // Sort by amount descending to handle larger amounts first
      discretionaryCats.sort((a, b) => b.recommendation - a.recommendation);

      // Apply reductions proportionally, handling rounding
      for (let i = 0; i < discretionaryCats.length; i++) {
        const cat = discretionaryCats[i]!;
        const isLast = i === discretionaryCats.length - 1;
        const proportion = cat.recommendation / totalDiscretionary;

        const originalAmount = cat.recommendation;

        if (isLast) {
          // Last category gets the remaining reduction
          const reduction = totalReduction - appliedReduction;
          cat.recommendation = Math.round((cat.recommendation - reduction) * 100) / 100;
        } else {
          const reduction = Math.round(totalReduction * proportion * 100) / 100;
          cat.recommendation = Math.round((cat.recommendation - reduction) * 100) / 100;
          appliedReduction += reduction;
        }
      }

      // Update group recommendations
      Object.values(spendingRecommendations).forEach(groupRec => {
        groupRec.recommendation = groupRec.categories
          .reduce((sum, cat) => sum + cat.recommendation, 0);
      });
    }

    // Calculate available money after spending adjustments
    const adjustedDiscretionarySpending = Object.values(spendingRecommendations)
      .reduce((sum, group) =>
        sum + group.categories
          .filter(cat => discretionaryCategories.includes(cat.categoryName))
          .reduce((catSum, cat) => catSum + cat.recommendation, 0)
        , 0);
    const availableAfterSpending = totalIncome - totalNonDiscretionarySpending - adjustedDiscretionarySpending;

    // If no money available for goals, clear all allocations
    if (availableAfterSpending <= 0) {
      Object.values(goalRecommendations).forEach(goalRec => {
        goalRec.monthlyAmounts = {};
      });
      return;
    }

    // Get original monthly amounts and total
    const originalMonthlyAmounts = new Map<string, number>();
    let totalOriginalMonthlyAmount = 0;
    Object.values(goalRecommendations).forEach(goalRec => {
      const firstMonth = Object.keys(goalRec.monthlyAmounts)[0];
      if (firstMonth) {
        const amount = goalRec.monthlyAmounts[firstMonth]!;
        originalMonthlyAmounts.set(goalRec.goalId, amount);
        totalOriginalMonthlyAmount += amount;
      }
    });

    // Process goals for balanced strategy
    if (availableAfterSpending < totalOriginalMonthlyAmount) {
      const extensionRatio = totalOriginalMonthlyAmount / availableAfterSpending;

      Object.values(goalRecommendations).forEach(goalRec => {
        const originalMonths = Object.keys(goalRec.monthlyAmounts).sort();
        const totalNeeded = Object.values(goalRec.monthlyAmounts).reduce((sum, amt) => sum + amt, 0);
        const extendedMonthCount = Math.ceil(originalMonths.length * extensionRatio);

        // Use helper to calculate monthly allocations
        const monthlyAllocations = this.calculateMonthlyAllocationsWithRemainder(totalNeeded, extendedMonthCount);

        // Create new monthly amounts with extended timeline
        const newMonthlyAmounts: Record<string, number> = {};

        // Parse starting date
        const [startYear, startMonth] = originalMonths[0]!.split('-').map(Number);

        // Generate all months
        for (let i = 0; i < extendedMonthCount; i++) {
          const totalMonths = (startMonth! - 1) + i;
          const year = startYear! + Math.floor(totalMonths / 12);
          const month = (totalMonths % 12) + 1;

          const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
          newMonthlyAmounts[monthKey] = monthlyAllocations[i]!;
        }

        goalRec.monthlyAmounts = newMonthlyAmounts;
      });
    } else {
      // We have enough funds - keep original timeline but recalculate amounts
      Object.values(goalRecommendations).forEach(goalRec => {
        const originalMonths = Object.keys(goalRec.monthlyAmounts).sort();
        const totalNeeded = Object.values(goalRec.monthlyAmounts).reduce((sum, amt) => sum + amt, 0);
        const monthCount = originalMonths.length;

        // Use helper to calculate monthly allocations
        const monthlyAllocations = this.calculateMonthlyAllocationsWithRemainder(totalNeeded, monthCount);

        // Create new monthly amounts with original timeline
        const newMonthlyAmounts: Record<string, number> = {};

        // Generate months
        originalMonths.forEach((monthKey, i) => {
          newMonthlyAmounts[monthKey] = monthlyAllocations[i]!;
        });

        goalRec.monthlyAmounts = newMonthlyAmounts;
      });
    }
  }

  /**
   * 2. Applies conservative strategy to spending and goals
   * @param spendingRecommendations - Current spending recommendations by category group
   * @param goalRecommendations - Current goal recommendations
   * @param totalIncome - Total monthly income
   * @param totalNonDiscretionarySpending - Total non-discretionary spending
   * @param totalDiscretionarySpending - Total discretionary spending
   * @param discretionaryCategories - List of categories considered discretionary
   */
  private onboardingRecommendSpendingAndGoalsConservativeStrategy(
    spendingRecommendations: Record<string, BudgetSpendingCategoryGroupRecommendation>,
    goalRecommendations: Record<string, BudgetGoalSpendingRecommendation>,
    totalIncome: number,
    totalNonDiscretionarySpending: number,
    totalDiscretionarySpending: number,
    discretionaryCategories: string[]
  ): void {
    // Calculate total desired spending
    const totalDesiredSpending = totalNonDiscretionarySpending + totalDiscretionarySpending;

    // Calculate total discretionary spending
    const totalDiscretionary = Object.values(spendingRecommendations)
      .reduce((sum, group) =>
        sum + group.categories
          .filter(cat => discretionaryCategories.includes(cat.categoryName))
          .reduce((catSum, cat) => catSum + cat.recommendation, 0)
        , 0);

    // Calculate deficit if any
    const deficit = Math.max(0, totalDesiredSpending - totalIncome);

    // Conservative strategy always tries to reduce by 20% if possible
    const desiredReductionPercent = 0.2;

    if (deficit > 0) {
      // If there's a deficit, use the larger of 20% or required reduction
      const baseReductionPercent = deficit / totalDiscretionary;
      const reductionPercent = Math.max(baseReductionPercent, desiredReductionPercent);

      // Cap at 50% maximum reduction
      const maxReduction = totalDiscretionary * 0.5;
      const reductionNeeded = Math.min(maxReduction, reductionPercent * totalDiscretionary);
      const finalReductionPercent = reductionNeeded / totalDiscretionary;

      // Apply reduction
      Object.values(spendingRecommendations).forEach(groupRec => {
        groupRec.categories.forEach(catRec => {
          if (discretionaryCategories.includes(catRec.categoryName)) {
            catRec.recommendation = Math.round(catRec.recommendation * (1 - finalReductionPercent) * 100) / 100;
          }
        });
        groupRec.recommendation = groupRec.categories
          .reduce((sum, cat) => sum + cat.recommendation, 0);
      });
    } else {
      // No deficit, but still reduce by 20%
      Object.values(spendingRecommendations).forEach(groupRec => {
        groupRec.categories.forEach(catRec => {
          if (discretionaryCategories.includes(catRec.categoryName)) {
            catRec.recommendation = Math.round(catRec.recommendation * (1 - desiredReductionPercent) * 100) / 100;
          }
        });
        groupRec.recommendation = groupRec.categories
          .reduce((sum, cat) => sum + cat.recommendation, 0);
      });
    }

    // Calculate available money after spending adjustments
    const adjustedDiscretionarySpending = Object.values(spendingRecommendations)
      .reduce((sum, group) =>
        sum + group.categories
          .filter(cat => discretionaryCategories.includes(cat.categoryName))
          .reduce((catSum, cat) => catSum + cat.recommendation, 0)
        , 0);
    const availableAfterSpending = totalIncome - totalNonDiscretionarySpending - adjustedDiscretionarySpending;

    // If no money available for goals, clear all allocations
    if (availableAfterSpending <= 0) {
      Object.values(goalRecommendations).forEach(goalRec => {
        goalRec.monthlyAmounts = {};
      });
      return;
    }

    // Get original monthly amounts and total
    const originalMonthlyAmounts = new Map<string, number>();
    let totalOriginalMonthlyAmount = 0;
    Object.values(goalRecommendations).forEach(goalRec => {
      const firstMonth = Object.keys(goalRec.monthlyAmounts)[0];
      if (firstMonth) {
        const amount = goalRec.monthlyAmounts[firstMonth]!;
        originalMonthlyAmounts.set(goalRec.goalId, amount);
        totalOriginalMonthlyAmount += amount;
      }
    });

    if (availableAfterSpending >= totalOriginalMonthlyAmount) {
      // We have extra funds - increase amounts and reduce months
      Object.values(goalRecommendations).forEach(goalRec => {
        const originalAmount = originalMonthlyAmounts.get(goalRec.goalId) || 0;
        const totalNeeded = Object.values(goalRec.monthlyAmounts).reduce((sum, amt) => sum + amt, 0);

        // Calculate new monthly amount based on proportion of available funds
        const proportion = originalAmount / totalOriginalMonthlyAmount;
        const increasedMonthlyAmount = Math.floor((availableAfterSpending * proportion) * 100) / 100;
        const monthsNeeded = Math.ceil(totalNeeded / increasedMonthlyAmount);

        // Use helper to calculate monthly allocations
        const monthlyAllocations = this.calculateMonthlyAllocationsWithRemainder(totalNeeded, monthsNeeded);

        // Create new monthly amounts with increased allocations and fewer months
        const newMonthlyAmounts: Record<string, number> = {};
        const originalMonths = Object.keys(goalRec.monthlyAmounts).sort();

        // Parse starting date
        const [startYear, startMonth] = originalMonths[0]!.split('-').map(Number);

        // Generate months
        for (let i = 0; i < monthsNeeded; i++) {
          const totalMonths = (startMonth! - 1) + i;
          const year = startYear! + Math.floor(totalMonths / 12);
          const month = (totalMonths % 12) + 1;

          const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
          newMonthlyAmounts[monthKey] = monthlyAllocations[i]!;
        }

        goalRec.monthlyAmounts = newMonthlyAmounts;
      });
    } else {
      // Not enough funds - extend timeline
      const extensionRatio = totalOriginalMonthlyAmount / availableAfterSpending;

      Object.values(goalRecommendations).forEach(goalRec => {
        const originalMonths = Object.keys(goalRec.monthlyAmounts).sort();
        const totalNeeded = Object.values(goalRec.monthlyAmounts).reduce((sum, amt) => sum + amt, 0);
        const extendedMonthCount = Math.ceil(originalMonths.length * extensionRatio);

        // Use helper to calculate monthly allocations
        const monthlyAllocations = this.calculateMonthlyAllocationsWithRemainder(totalNeeded, extendedMonthCount);

        // Create new monthly amounts with extended timeline
        const newMonthlyAmounts: Record<string, number> = {};

        // Parse starting date
        const [startYear, startMonth] = originalMonths[0]!.split('-').map(Number);

        // Generate all months
        for (let i = 0; i < extendedMonthCount; i++) {
          const totalMonths = (startMonth! - 1) + i;
          const year = startYear! + Math.floor(totalMonths / 12);
          const month = (totalMonths % 12) + 1;

          const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
          newMonthlyAmounts[monthKey] = monthlyAllocations[i]!;
        }

        goalRec.monthlyAmounts = newMonthlyAmounts;
      });
    }
  }

  /**
   * 3. Applies relaxed strategy to spending and goals
   * @param spendingRecommendations - Current spending recommendations by category group
   * @param goalRecommendations - Current goal recommendations
   * @param totalIncome - Total monthly income
   * @param totalNonDiscretionarySpending - Total non-discretionary spending
   * @param totalDiscretionarySpending - Total discretionary spending
   * @param discretionaryCategories - List of categories considered discretionary
   */
  private onboardingRecommendSpendingAndGoalsRelaxedStrategy(
    spendingRecommendations: Record<string, BudgetSpendingCategoryGroupRecommendation>,
    goalRecommendations: Record<string, BudgetGoalSpendingRecommendation>,
    totalIncome: number,
    totalNonDiscretionarySpending: number,
    totalDiscretionarySpending: number,
    discretionaryCategories: string[]
  ): void {
    // Calculate total desired spending
    const totalDesiredSpending = totalNonDiscretionarySpending + totalDiscretionarySpending;

    // Calculate surplus/deficit
    const surplus = totalIncome - totalDesiredSpending;

    // Calculate total discretionary spending
    const totalDiscretionary = Object.values(spendingRecommendations)
      .reduce((sum, group) =>
        sum + group.categories
          .filter(cat => discretionaryCategories.includes(cat.categoryName))
          .reduce((catSum, cat) => catSum + cat.recommendation, 0)
      , 0);

    if (surplus >= 0) {
      // We can increase spending - try to increase by up to 20%
      const maxIncrease = totalDiscretionary * 0.2;
      const actualIncrease = Math.min(maxIncrease, surplus);
      const increasePercent = actualIncrease / totalDiscretionary;

      // Apply increase to discretionary categories
      Object.values(spendingRecommendations).forEach(groupRec => {
        groupRec.categories.forEach(catRec => {
          if (discretionaryCategories.includes(catRec.categoryName)) {
            catRec.recommendation = Math.round(catRec.recommendation * (1 + increasePercent) * 100) / 100;
          }
        });
        // Update group recommendation
        groupRec.recommendation = groupRec.categories
          .reduce((sum, cat) => sum + cat.recommendation, 0);
      });
    } else {
      // We need to reduce spending - use minimum required reduction
      const deficit = -surplus;
      const maxReduction = totalDiscretionary * 0.5; // Cap at 50%
      const reductionNeeded = Math.min(deficit, maxReduction);
      const reductionPercent = reductionNeeded / totalDiscretionary;

      // Apply reduction to discretionary categories
      Object.values(spendingRecommendations).forEach(groupRec => {
        groupRec.categories.forEach(catRec => {
          if (discretionaryCategories.includes(catRec.categoryName)) {
            catRec.recommendation = Math.round(catRec.recommendation * (1 - reductionPercent) * 100) / 100;
          }
        });
        // Update group recommendation
        groupRec.recommendation = groupRec.categories
          .reduce((sum, cat) => sum + cat.recommendation, 0);
      });
    }

    // Calculate available money after spending adjustments
    const adjustedDiscretionarySpending = Object.values(spendingRecommendations)
      .reduce((sum, group) =>
        sum + group.categories
          .filter(cat => discretionaryCategories.includes(cat.categoryName))
          .reduce((catSum, cat) => catSum + cat.recommendation, 0)
      , 0);
    const availableAfterSpending = totalIncome - totalNonDiscretionarySpending - adjustedDiscretionarySpending;

    // If no money available for goals, clear all allocations
    if (availableAfterSpending <= 0) {
      Object.values(goalRecommendations).forEach(goalRec => {
        goalRec.monthlyAmounts = {};
      });
      return;
    }

    // Get original monthly amounts and total
    const totalMonthlyGoals = Object.values(goalRecommendations)
      .reduce((sum, goal) => {
        const firstMonth = Object.keys(goal.monthlyAmounts)[0];
        if (!firstMonth) return sum;
        return sum + (goal.monthlyAmounts[firstMonth] || 0);
      }, 0);

    if (totalMonthlyGoals > availableAfterSpending) {
      // Only reduce if we don't have enough funds
      Object.values(goalRecommendations).forEach(goalRec => {
        const originalMonths = Object.keys(goalRec.monthlyAmounts).sort();
        const totalNeeded = Object.values(goalRec.monthlyAmounts).reduce((sum, amt) => sum + amt, 0);
        const adjustmentRatio = availableAfterSpending / totalMonthlyGoals;
        const monthCount = originalMonths.length;

        // Use helper to calculate monthly allocations with adjusted total
        const adjustedTotal = totalNeeded * adjustmentRatio;
        const monthlyAllocations = this.calculateMonthlyAllocationsWithRemainder(adjustedTotal, monthCount);

        // Create new monthly amounts with original timeline
        const newMonthlyAmounts: Record<string, number> = {};

        // Generate months
        originalMonths.forEach((monthKey, i) => {
          newMonthlyAmounts[monthKey] = monthlyAllocations[i]!;
        });

        goalRec.monthlyAmounts = newMonthlyAmounts;
      });
    } else {
      // We have enough funds - keep original timeline but recalculate amounts
      Object.values(goalRecommendations).forEach(goalRec => {
        const originalMonths = Object.keys(goalRec.monthlyAmounts).sort();
        const totalNeeded = Object.values(goalRec.monthlyAmounts).reduce((sum, amt) => sum + amt, 0);
        const monthCount = originalMonths.length;

        // Use helper to calculate monthly allocations
        const monthlyAllocations = this.calculateMonthlyAllocationsWithRemainder(totalNeeded, monthCount);

        // Create new monthly amounts with original timeline
        const newMonthlyAmounts: Record<string, number> = {};

        // Generate months
        originalMonths.forEach((monthKey, i) => {
          newMonthlyAmounts[monthKey] = monthlyAllocations[i]!;
        });

        goalRec.monthlyAmounts = newMonthlyAmounts;
      });
    }
  }

  /**
   * 4. Initializes transaction data for analysis
   * @param transactions - Array of transactions to initialize
   * @returns Object containing sorted transactions and latest month's data
   */
  private onboardingRecommendSpendingAndGoalsInitializeTransactions(
    transactions: BudgetFinAccountTransaction[]
  ): {
    sortedTransactions: BudgetFinAccountTransaction[],
    latestRollingMonthTransactions: BudgetFinAccountTransaction[]
  } {
    // Sort transactions by date
    const sortedTransactions = [...transactions]
      .sort((a, b) => new Date(b.transaction.date).getTime() - new Date(a.transaction.date).getTime());
    if (!sortedTransactions[0]) {
      return {
        sortedTransactions: [],
        latestRollingMonthTransactions: []
      };
    }

    const latestTransactionDate = new Date(sortedTransactions[0].transaction.date);
    const thirtyDaysAgo = new Date(latestTransactionDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get transactions for recommendations (latest rolling 30 days)
    const latestRollingMonthTransactions = sortedTransactions.filter(
      t => new Date(t.transaction.date) >= thirtyDaysAgo
    );

    return {
      sortedTransactions,
      latestRollingMonthTransactions
    };
  }

  /**
   * 5. Sets up category mappings and classifications
   * @param categoryGroups - Record of category groups to process
   * @returns Object containing discretionary categories and category-to-group mapping
   */
  private async onboardingRecommendSpendingAndGoalsSetupCategories(
    categoryGroups: Record<string, CategoryGroup>
  ): Promise<{
    discretionaryCategories: string[],
    categoryToGroupMap: Record<string, string>
  }> {
    // Define discretionary categories
    const discretionaryCategories = [
      'Shopping',
      'Online Marketplaces',
      'Superstores',
      'Other Entertainment',
      'Events & Amusement',
      'Video Games',
      'TV & Movies',
      'Music & Audio'
    ];

    // Create mapping of categories to their groups
    const categoryToGroupMap = Object.values(categoryGroups).reduce((acc, group) => {
      group.categories.forEach(category => {
        acc[category.name] = group.name;
      });
      return acc;
    }, {} as Record<string, string>);

    return {
      discretionaryCategories,
      categoryToGroupMap
    };
  }

  /**
   * 6. Calculates monthly spending records
   * @param budgetTransactions - Array of sorted transactions
   * @param categoryGroups - Record of category groups
   * @param categoryToGroupMap - Mapping of categories to their groups
   * @returns Object containing monthly spending tracking data
   */
  private calculateSpendingTrackings(
    budgetTransactions: BudgetFinAccountTransaction[],
    categoryGroups: Record<string, CategoryGroup>
  ): {
    spendingTrackingsByMonth: BudgetSpendingTrackingsByMonth
  } {
    // Find date range
    const earliestTransactionDate = new Date(budgetTransactions[budgetTransactions.length - 1]!.transaction.date);

    // Initialize spending tracking data structure for all months in range
    const spendingTrackingsByMonth: BudgetSpendingTrackingsByMonth = {};
    const currentDate = new Date(earliestTransactionDate);
    const endDate = new Date();

    // Set both dates to the first of their respective months
    currentDate.setDate(1);
    endDate.setDate(2);

    // Initialize all months in range with all possible groups
    while (currentDate <= endDate) {
      const monthKey = currentDate.toISOString().substring(0, 7);

      spendingTrackingsByMonth[monthKey] = {};

      // Initialize all possible groups for this month
      Object.values(categoryGroups).forEach(group => {
        spendingTrackingsByMonth[monthKey]![group.name] = {
          groupName: group.name,
          targetSource: 'group',
          spendingActual: 0,
          spendingTarget: 0,
          categories: [],
          isTaxDeductible: false
        };
      });

      // Add "Other" group initialization
      spendingTrackingsByMonth[monthKey]!['Other'] = {
        groupName: 'Other',
        targetSource: 'group',
        spendingActual: 0,
        spendingTarget: 0,
        categories: [],
        isTaxDeductible: false
      };

      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // Group transactions by month
    const monthlyTransactions: Record<string, BudgetFinAccountTransaction[]> = {};
    budgetTransactions.forEach(budgetTransaction => {
      const monthKey = budgetTransaction.transaction.date.substring(0, 7);
      if (!monthlyTransactions[monthKey]) {
        monthlyTransactions[monthKey] = [];
      }
      monthlyTransactions[monthKey].push(budgetTransaction);
    });

    // generate categoryToGroupMap
    const categoryToGroupMap = Object.values(categoryGroups).reduce((acc, group) => {
      group.categories.forEach(category => {
        acc[category.name] = group.name;
      });
      return acc;
    }, {} as Record<string, string>);

    // Process each month's transactions
    Object.entries(monthlyTransactions)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([monthKey, monthTransactions]) => {
        // Process each transaction for this month
        monthTransactions.forEach(budgetTransaction => {
          if (!budgetTransaction.category) {
            console.warn('Transaction missing category:', budgetTransaction);
            return;
          }

          const groupName = categoryToGroupMap[budgetTransaction.category] || 'Other';
          const isIncomeGroup = groupName.toLowerCase() === 'income';
          const amount = isIncomeGroup ? -Math.abs(budgetTransaction.transaction.amount) : budgetTransaction.transaction.amount;

          // Group should already be initialized, but just in case
          if (!spendingTrackingsByMonth[monthKey]?.[groupName]) {
            console.warn(`Group ${groupName} not found for month ${monthKey}, initializing`);
            spendingTrackingsByMonth[monthKey]![groupName] = {
              groupName,
              targetSource: 'group',
              spendingActual: 0,
              spendingTarget: 0,
              categories: [],
              isTaxDeductible: false
            };
          }

          const group = spendingTrackingsByMonth[monthKey]![groupName]!;

          // Update group totals without rounding
          group.spendingActual += amount;
          group.spendingTarget += amount;

          // Find or create category tracking
          let categoryTracking = group.categories.find(cat => cat.categoryName === budgetTransaction.category);
          if (!categoryTracking) {
            categoryTracking = {
              categoryName: budgetTransaction.category,
              spendingActual: amount,
              spendingTarget: amount,
              isTaxDeductible: false
            };
            group.categories.push(categoryTracking);
          } else {
            categoryTracking.spendingActual += amount;
            categoryTracking.spendingTarget += amount;
          }
        });
      });

    return { spendingTrackingsByMonth };
  }

  /**
   * 7. Analyzes spending patterns and totals
   * @param latestRollingMonthTransactions - Array of transactions from latest month
   * @param discretionaryCategories - List of discretionary category names
   * @param categoryGroups - Record of category groups
   * @param categoryToGroupMap - Mapping of categories to their groups
   * @returns Object containing spending analysis and initial recommendations
   */
  private onboardingRecommendSpendingAndGoalsAnalyzeSpending(
    latestRollingMonthTransactions: BudgetFinAccountTransaction[],
    discretionaryCategories: string[],
    categoryGroups: Record<string, CategoryGroup>,
    categoryToGroupMap: Record<string, string>
  ): {
    totalIncome: number,
    totalDiscretionarySpending: number,
    totalNonDiscretionarySpending: number,
    initialSpendingRecommendations: BudgetSpendingRecommendations
  } {
    // Aggregate transactions by category for the rolling month
    const latestRollingMonthCategorySpending = latestRollingMonthTransactions.reduce((acc, budgetTransaction) => {
      const category = budgetTransaction.category!;
      acc[category] = (acc[category] || 0) + budgetTransaction.transaction.amount;
      return acc;
    }, {} as Record<string, number>);

    // Ensure income is treated as a positive number for calculations
    const totalIncome = Math.abs(latestRollingMonthCategorySpending['Income'] || 0);

    // Calculate discretionary spending total
    const totalDiscretionarySpending = Object.entries(latestRollingMonthCategorySpending)
      .filter(([cat]) => discretionaryCategories.includes(cat))
      .reduce((sum, [, amount]) => sum + Math.abs(amount), 0);

    // Calculate non-discretionary spending total
    const totalNonDiscretionarySpending = Object.entries(latestRollingMonthCategorySpending)
      .filter(([cat]) => !discretionaryCategories.includes(cat) && cat !== 'Income')
      .reduce((sum, [, amount]) => sum + Math.abs(amount), 0);

    // Initialize recommendations structure with actual spending amounts
    const initialSpendingRecommendations: BudgetSpendingRecommendations = {
      balanced: {},
      conservative: {},
      relaxed: {}
    };

    // Initialize all strategies with the same base recommendations
    ['balanced', 'conservative', 'relaxed'].forEach(strategy => {
      const strategyKey = strategy as keyof BudgetSpendingRecommendations;

      // Initialize all category groups for this strategy
      Object.values(categoryGroups).forEach(group => {
        initialSpendingRecommendations[strategyKey][group.name] = {
          groupName: group.name,
          recommendation: 0,
          spending: 0,
          targetSource: 'group',
          categories: []
        };
      });

      // Process spending data for each category
      Object.entries(latestRollingMonthCategorySpending).forEach(([category, spending]) => {
        const groupName = categoryToGroupMap[category] || 'Other';
        const isIncome = category === 'Income';

        // Use actual spending amounts (no reductions applied)
        const amount = isIncome ? -Math.abs(spending) : spending;

        // Update recommendations
        initialSpendingRecommendations[strategyKey][groupName]!.recommendation += amount;
        initialSpendingRecommendations[strategyKey][groupName]!.spending += amount;

        initialSpendingRecommendations[strategyKey][groupName]!.categories.push({
          categoryName: category,
          recommendation: amount,
          spending: amount
        });
      });
    });

    return {
      totalIncome,
      totalDiscretionarySpending,
      totalNonDiscretionarySpending,
      initialSpendingRecommendations
    };
  }

  /**
   * 8. Applies strategy-specific recommendations
   * @param initialSpendingRecommendations - Initial spending recommendations
   * @param discretionaryCategories - List of discretionary categories
   * @param goals - Array of budget goals
   * @param spendingTrackings - Current spending tracking data
   * @param totalIncome - Total monthly income
   * @param totalNonDiscretionarySpending - Total non-discretionary spending
   * @param totalDiscretionarySpending - Total discretionary spending
   * @returns Object containing final recommendations and tracking data
   */
  private onboardingRecommendSpendingAndGoalsApplyStrategies(
    initialSpendingRecommendations: BudgetSpendingRecommendations,
    discretionaryCategories: string[],
    goals: BudgetGoal[],
    spendingTrackings: BudgetSpendingTrackingsByMonth,
    totalIncome: number,
    totalNonDiscretionarySpending: number,
    totalDiscretionarySpending: number,
  ): {
    spendingRecommendations: BudgetSpendingRecommendations,
    spendingTrackings: BudgetSpendingTrackingsByMonth,
    goalSpendingRecommendations: BudgetGoalRecommendations,
    goalSpendingTrackings: Record<string, BudgetGoalSpendingTrackingsByMonth>
  } {
    // Create strategy-specific recommendations
    const spendingRecommendations: BudgetSpendingRecommendations = {
      balanced: initialSpendingRecommendations.balanced,
      conservative: initialSpendingRecommendations.conservative,
      relaxed: initialSpendingRecommendations.relaxed
    };

    // Initialize goal recommendations for all strategies
    const goalSpendingRecommendations: BudgetGoalRecommendations = {
      balanced: {},
      conservative: {},
      relaxed: {}
    };

    // Calculate initial monthly allocations based on goal amount and target date
    goals.forEach(goal => {
      const targetDate = new Date(goal.targetDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get day of month from target date (will be used for all allocations)
      const targetDayOfMonth = targetDate.getDate();

      // Start from next month if we've passed this month's target day
      let currentDate = new Date(today);
      const currentDayOfMonth = today.getDate();

      if (currentDayOfMonth >= targetDayOfMonth) {
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      currentDate.setDate(1); // Reset to start of month for clean iteration

      // Calculate months between start and target
      const monthsUntilTarget = Math.floor(
        (targetDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
      );

      // Calculate monthly amount
      const monthlyAmount = goal.amount / monthsUntilTarget;
      const monthlyAmounts: Record<string, number> = {};

      // Generate monthly dates with proper day of month handling
      for (let i = 0; i < monthsUntilTarget; i++) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;

        // Determine the correct day for this month
        let dayOfMonth = targetDayOfMonth;
        const lastDayOfMonth = new Date(year, month, 0).getDate();

        if (targetDayOfMonth > lastDayOfMonth) {
          dayOfMonth = lastDayOfMonth;
        }

        // Format as YYYY-MM
        const monthKey = currentDate.toISOString().slice(0, 7);
        monthlyAmounts[monthKey] = monthlyAmount;

        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      // Set recommendations for each strategy
      ['balanced', 'conservative', 'relaxed'].forEach(strategy => {
        goalSpendingRecommendations[strategy as keyof BudgetGoalRecommendations][goal.id] = {
          goalId: goal.id,
          monthlyAmounts: { ...monthlyAmounts }
        };
      });
    });

    // Apply each strategy
    this.onboardingRecommendSpendingAndGoalsBalancedStrategy(
      spendingRecommendations.balanced,
      goalSpendingRecommendations.balanced,
      totalIncome,
      totalNonDiscretionarySpending,
      totalDiscretionarySpending,
      discretionaryCategories
    );

    this.onboardingRecommendSpendingAndGoalsConservativeStrategy(
      spendingRecommendations.conservative,
      goalSpendingRecommendations.conservative,
      totalIncome,
      totalNonDiscretionarySpending,
      totalDiscretionarySpending,
      discretionaryCategories
    );

    this.onboardingRecommendSpendingAndGoalsRelaxedStrategy(
      spendingRecommendations.relaxed,
      goalSpendingRecommendations.relaxed,
      totalIncome,
      totalNonDiscretionarySpending,
      totalDiscretionarySpending,
      discretionaryCategories
    );

    // Initialize goal trackings structure
    const goalSpendingTrackings: Record<string, BudgetGoalSpendingTrackingsByMonth> = {};

    // Process goals once using balanced strategy recommendations
    goals.forEach(goal => {
      // Initialize tracking structure for this goal
      goalSpendingTrackings[goal.id] = {};

      const balancedRecs = goalSpendingRecommendations.balanced[goal.id];
      if (!balancedRecs) {
        console.warn(`No balanced recommendations found for goal ${goal.id}`);
        return;
      }

      // Get months from recommendations (this represents the actual timeline)
      const recommendedMonths = Object.keys(balancedRecs.monthlyAmounts).sort();

      // Process each month in the recommendations timeline
      recommendedMonths.forEach((month, monthIndex) => {
        const recommendedMonthlyAmount = balancedRecs.monthlyAmounts[month] || 0;
        const originalTracking = goal.spendingTracking[month] || {
          month,
          startingBalance: 0,
          allocations: {}
        };

        // Initialize month in tracking
        goalSpendingTrackings[goal.id]![month] = {
          month,
          startingBalance: monthIndex === 0 ? goal.budgetFinAccountBalance ?? 0 : 0,
          allocations: {}
        };

        if (Object.keys(originalTracking.allocations).length === 0) {
          // If no original allocations exist for this month, create one on the 25th
          if (recommendedMonthlyAmount > 0) {
            goalSpendingTrackings[goal.id]![month]!.allocations[`${month}-25`] = {
              dateTarget: `${month}-25`,
              amountTarget: recommendedMonthlyAmount
            };
          }
        } else {
          // Preserve existing allocation structure with adjusted amounts
          const originalMonthlyTotal = Object.values(originalTracking.allocations)
            .reduce((sum, allocation) => sum + allocation.amountTarget, 0);

          Object.entries(originalTracking.allocations).forEach(([date, originalAllocation]) => {
            let adjustedAmount = 0;
            if (originalMonthlyTotal > 0) {
              const adjustmentRatio = recommendedMonthlyAmount / originalMonthlyTotal;
              adjustedAmount = Math.round(originalAllocation.amountTarget * adjustmentRatio * 100) / 100;
            }

            goalSpendingTrackings[goal.id]![month]!.allocations[date] = {
              dateTarget: originalAllocation.dateTarget,
              amountTarget: adjustedAmount
            };
          });
        }
      });
    });

    return {
      spendingRecommendations,
      spendingTrackings,
      goalSpendingRecommendations,
      goalSpendingTrackings
    };
  }

  /**
   * 9. Rounds numeric values in final results
   * @param results - Results object to process
   * @returns Results object with rounded numeric values
   */
  private onboardingRecommendSpendingAndGoalsRoundValues(
    results: OnboardingRecommendSpendingAndGoalsResult
  ): OnboardingRecommendSpendingAndGoalsResult {
    if (!results.spendingRecommendations || !results.spendingTrackings || !results.goalSpendingRecommendations || !results.goalSpendingTrackings) {
      return results;
    }

    // Round spending recommendations for all strategies
    ['balanced', 'conservative', 'relaxed'].forEach(strategy => {
      const strategyRecs = results.spendingRecommendations![strategy as keyof BudgetSpendingRecommendations];
      Object.values(strategyRecs).forEach(groupRec => {
        groupRec.recommendation = Math.round(groupRec.recommendation * 100) / 100;
        groupRec.spending = Math.round(groupRec.spending * 100) / 100;
        groupRec.categories.forEach(catRec => {
          catRec.recommendation = Math.round(catRec.recommendation * 100) / 100;
          catRec.spending = Math.round(catRec.spending * 100) / 100;
        });
      });
    });

    // Round spending tracking values
    Object.values(results.spendingTrackings).forEach(monthTrackings => {
      Object.values(monthTrackings).forEach(groupTracking => {
        groupTracking.spendingActual = Math.round(groupTracking.spendingActual * 100) / 100;
        groupTracking.spendingTarget = Math.round(groupTracking.spendingTarget * 100) / 100;
        groupTracking.categories.forEach(categoryTracking => {
          categoryTracking.spendingActual = Math.round(categoryTracking.spendingActual * 100) / 100;
          categoryTracking.spendingTarget = Math.round(categoryTracking.spendingTarget * 100) / 100;
        });
      });
    });

    // Round goal recommendations for all strategies
    ['balanced', 'conservative', 'relaxed'].forEach(strategy => {
      const strategyRecs = results.goalSpendingRecommendations![strategy as keyof BudgetGoalRecommendations];
      Object.values(strategyRecs).forEach(goalRec => {
        Object.entries(goalRec.monthlyAmounts).forEach(([month, amount]) => {
          goalRec.monthlyAmounts[month] = Math.round(amount * 100) / 100;
        });
      });
    });

    // Round goal tracking values
    Object.values(results.goalSpendingTrackings).forEach(monthTracking => {
      Object.values(monthTracking).forEach(goalTracking => {
        // Round starting/ending balances
        goalTracking.startingBalance = Math.round(goalTracking.startingBalance * 100) / 100;
        if (goalTracking.endingBalance !== undefined) {
          goalTracking.endingBalance = Math.round(goalTracking.endingBalance * 100) / 100;
        }

        // Round allocation amounts
        Object.values(goalTracking.allocations).forEach(allocation => {
          allocation.amountTarget = Math.round(allocation.amountTarget * 100) / 100;
          if (allocation.amountActual !== undefined) {
            allocation.amountActual = Math.round(allocation.amountActual * 100) / 100;
          }
        });
      });
    });

    return results;
  }

  /**
   * Main method for onboarding analysis
   * @param budgetId - The ID of the budget to analyze
   * @param plaidConnectionItems - Array of Plaid connection items
   * @param plaidConfiguration - Plaid API configuration
   * @returns ServiceResult containing analysis results or error
   */
  async onboardingRecommendSpendingAndGoals(
    transactions: BudgetFinAccountTransaction[],
    goals: BudgetGoal[],
    categoryGroups: Record<string, CategoryGroup>
  ): Promise<OnboardingRecommendSpendingAndGoalsResult> {
    try {
      // 1. Initialize and prepare transaction data
      const {
        sortedTransactions,
        latestRollingMonthTransactions
      } = this.onboardingRecommendSpendingAndGoalsInitializeTransactions(transactions);

      // 2. Setup categories and groups
      const {
        discretionaryCategories,
        categoryToGroupMap
      } = await this.onboardingRecommendSpendingAndGoalsSetupCategories(categoryGroups);

      // 3. Calculate spending records
      const {
        spendingTrackingsByMonth
      } = this.calculateSpendingTrackings(
        sortedTransactions,
        categoryGroups
      );

      // 4. Calculate spending totals and check essentials coverage
      const {
        totalIncome,
        totalDiscretionarySpending,
        totalNonDiscretionarySpending,
        initialSpendingRecommendations
      } = this.onboardingRecommendSpendingAndGoalsAnalyzeSpending(
        latestRollingMonthTransactions,
        discretionaryCategories,
        categoryGroups,
        categoryToGroupMap
      );

      // 5. Apply recommendations for each strategy
      const {
        spendingRecommendations,
        spendingTrackings: updatedSpendingTrackings,
        goalSpendingRecommendations,
        goalSpendingTrackings
      } = this.onboardingRecommendSpendingAndGoalsApplyStrategies(
        initialSpendingRecommendations,
        discretionaryCategories,
        goals,
        spendingTrackingsByMonth,
        totalIncome,
        totalNonDiscretionarySpending,
        totalDiscretionarySpending
      );

      const results: OnboardingRecommendSpendingAndGoalsResult = {
        spendingRecommendations,
        spendingTrackings: updatedSpendingTrackings,
        goalSpendingRecommendations,
        goalSpendingTrackings,
        error: null
      };

      // 6. Final rounding of values
      const finalResults = this.onboardingRecommendSpendingAndGoalsRoundValues(results);


      return finalResults;
    } catch (error) {
      console.error('Error in onboardingRecommendSpendingAndGoals:', error);
      return {
        spendingRecommendations: null,
        spendingTrackings: null,
        goalSpendingRecommendations: null,
        goalSpendingTrackings: null,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      };
    }
  }

  /**
   * Helper function to calculate monthly allocations with proper remainder handling
   * @param totalAmount Total goal amount
   * @param numMonths Number of months to allocate over
   * @returns Array of monthly amounts with proper remainder handling
   */
  private calculateMonthlyAllocationsWithRemainder(totalAmount: number, numMonths: number): number[] {
    // Calculate base monthly amount (rounded down to 2 decimal places)
    const baseMonthlyAmount = Math.floor((totalAmount / numMonths) * 100) / 100;
    
    // Calculate total with base amounts
    const totalWithBaseAmounts = baseMonthlyAmount * (numMonths - 1);
    
    // Calculate remainder for the last payment
    const remainder = Math.round((totalAmount - totalWithBaseAmounts) * 100) / 100;

    // Create array of monthly amounts
    return Array.from({ length: numMonths }, (_, i) => 
      i === numMonths - 1 ? remainder : baseMonthlyAmount
    );
  }
}

interface OnboardingAnalysisTransactionCollection {
  allTransactions: BudgetFinAccountTransaction[];
  newTransactions: BudgetFinAccountTransaction[];
  itemCursors: Record<string, string>;
}

interface OnboardingAnalysisSpendingData {
  monthlyCategorySpending: Record<string, number>;
  spendingAnalysis: {
    totalIncome: number;
    totalSpending: number;
    categoryBreakdown: Record<string, number>;
  };
}

/**
 * Creates an instance of the BudgetService.
 * @param supabaseClient - The Supabase client instance
 * @returns An instance of BudgetService.
 */
export function createBudgetService(
  supabaseClient: SupabaseClient
): IBudgetService {
  return new BudgetService(supabaseClient);
}

export interface IBudgetService {
  createGoalTrackings: (goal: BudgetGoal, trackingStartingBalance: number) => ServiceResult<BudgetGoalSpendingTrackingsByMonth>;
  saveBudgetTransactions: (transactions: BudgetFinAccountTransaction[], budgetId: string) => Promise<ServiceResult<null>>;
  saveBudgetGoalWithTracking: (goal: BudgetGoal, trackingStartingBalance: number) => Promise<ServiceResult<BudgetGoal>>;
  getPlaidConnectionItemSummaries: (budgetId: string) => Promise<ServiceResult<PlaidConnectionItemSummary[]>>;
  getBudgetGoals: (budgetId: string) => Promise<Database['public']['Tables']['budget_goals']['Row'][]>;
  hasPermission: (params: {
    budgetId: string,
    userId: string,
    permission: Database['public']['Enums']['app_permissions']
  }) => Promise<ServiceResult<boolean>>;
  hasLinkedFinAccounts: (budgetId: string) => Promise<ServiceResult<null>>;
  validateBudgetReadyForOnboardingUserSetup: (budgetId: string) => Promise<ServiceResult<null>>;
  parseBudget: (budget: Database['public']['Functions']['get_budget_by_team_account_slug']['Returns'][number]) => Budget | null;
  parseBudgetGoal: (raw: Database['public']['Tables']['budget_goals']['Row']) => BudgetGoal | null;
  parseBudgetTransactions: (transactions: Database['public']['Functions']['get_budget_transactions_by_team_account_slug']['Returns']) => BudgetFinAccountTransaction[];
  parseBudgetTags: (tags: Database['public']['Functions']['get_budget_tags_by_team_account_slug']['Returns']) => BudgetFinAccountTransactionTag[];
  onboardingAnalysis: (
    budgetId: string,
    plaidConnectionItems: PlaidConnectionItemSummary[],
    plaidConfiguration: Configuration
  ) => Promise<ServiceResult<OnboardingRecommendSpendingAndGoalsResult>>;
  onboardingRecommendSpendingAndGoals: (
    transactions: BudgetFinAccountTransaction[],
    goals: BudgetGoal[],
    categoryGroups: Record<string, CategoryGroup>
  ) => Promise<OnboardingRecommendSpendingAndGoalsResult>;
  updateSpending: (
    budgetId: string,
    recommendations: BudgetSpendingRecommendations,
    tracking: BudgetSpendingTrackingsByMonth
  ) => Promise<ServiceResult<null>>;
  updateRecalculateSpending: (
    budgetId: string,
    months: string[]
  ) => Promise<ServiceResult<null>>;
  updateGoalSpending: (
    budgetId: string,
    recommendations: BudgetGoalRecommendations,
    goalTrackings: Record<string, BudgetGoalSpendingTrackingsByMonth>
  ) => Promise<ServiceResult<null>>;
}

export type PlaidConnectionItemSummary = {
  svendItemId: string;
  accessToken: string;
  nextCursor: string;
};

export type ServiceResult<T> = {
  data: T | null;
  error: string | null;
};

export type BudgetAnalysisResult = {
  results: OnboardingRecommendSpendingAndGoalsResult;
  error: string | null;
};

export type OnboardingRecommendSpendingAndGoalsResult = {
  spendingRecommendations: BudgetSpendingRecommendations | null;
  spendingTrackings: BudgetSpendingTrackingsByMonth | null;
  goalSpendingRecommendations: BudgetGoalRecommendations | null;
  // The key is the goal id
  goalSpendingTrackings: Record<string, BudgetGoalSpendingTrackingsByMonth> | null;
  error: string | null;
};
