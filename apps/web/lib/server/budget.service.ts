import { FinAccount, FinAccountRecurringTransaction, FinAccountTransaction } from '../model/fin.types';
import { BudgetFinAccountRecurringTransaction } from '../model/budget.types';
import { Database } from '../database.types';
import {
  Budget,
  BudgetGoal,
  BudgetGoalMonthlyTracking,
  BudgetGoalMultiRecommendations,
  BudgetGoalSpendingRecommendation,
  BudgetGoalSpendingTrackingsByMonth,
  BudgetSpendingCategoryGroupRecommendation,
  BudgetSpendingRecommendations,
  BudgetSpendingTrackingsByMonth,
  BudgetFinAccountTransaction,
  BudgetFinAccountTransactionTag,
  BudgetCategoryGroups
} from '../model/budget.types';
import { createCategoryService, ICategoryService } from './category.service';
import { SupabaseClient } from '@supabase/supabase-js';
import { Configuration, PlaidApi, TransactionsSyncRequest, TransactionStream, Transaction } from 'plaid';
import { createSpendingService, ISpendingService } from './spending.service';
import { createTransactionService, ITransactionService } from './transaction.service';
/**
 * @name BudgetService
 * @description Service for budget-related operations
 */
class BudgetService {
  private categoryService: ICategoryService;
  private transactionService: ITransactionService;
  private spendingService: ISpendingService;
  private supabase: SupabaseClient<Database>;

  constructor(
    supabaseClient: SupabaseClient
  ) {
    this.supabase = supabaseClient;
    // Use provided categoryService or create new one
    this.categoryService = createCategoryService(supabaseClient);
    this.spendingService = createSpendingService(supabaseClient);
    this.transactionService = createTransactionService(supabaseClient);
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
        return { data: null, error: '[getPlaidConnectionItemSummaries]:' + error.message };
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
   * @name getManualInstitutionIds
   * @description Gets manual institution IDs for a budget
   */
  async getManualInstitutionIds(budgetId: string): Promise<ServiceResult<string[]>> {
    try {
      const { data: items, error } = await this.supabase
        .from('manual_fin_accounts')
        .select(`
          institution_id,
          budget_fin_accounts (
            budget_id
          )
        `)
        .eq('budget_fin_accounts.budget_id', budgetId);

      if (error) {
        return { data: null, error: '[getManualInstitutionIds]:' + error.message };
      }

      const institutionIds = items.map(item => item.institution_id);

      return { data: institutionIds, error: null };
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
            type: account.type,
            source: account.source,
            institutionName: account.institutionName,
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
      const goals: BudgetGoal[] = rawGetBudgetResults.goals as any[];

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
      if (raw.id == null ||
        raw.name == null ||
        raw.type == null ||
        raw.amount == null ||
        raw.budget_id == null ||
        raw.target_date == null ||
        raw.fin_account_id == null ||
        raw.spending_tracking == null ||
        raw.spending_recommendations == null) {
        console.warn('parseBudgetGoal: Missing required fields:', {
          id: raw.id,
          name: raw.name,
          type: raw.type,
          amount: raw.amount,
          budget_id: raw.budget_id,
          target_date: raw.target_date,
          fin_account_id: raw.fin_account_id,
          spending_tracking: raw.spending_tracking,
          spending_recommendations: raw.spending_recommendations
        });
        return null;
      }

      // Validate goal type
      const validTypes: Database['public']['Enums']['budget_goal_type_enum'][] = ['debt', 'savings', 'investment'];
      if (!validTypes.includes(raw.type)) {
        console.warn('parseBudgetGoal: Invalid goal type:', raw.type);
        return null;
      }

      // Validate debt-specific fields when type is debt
      if (raw.type === 'debt') {
        if (raw.debt_interest_rate == null ||
          raw.debt_payment_component == null ||
          raw.debt_type == null) {
          console.warn('parseBudgetGoal: Missing required debt fields:', {
            debt_interest_rate: raw.debt_interest_rate,
            debt_payment_component: raw.debt_payment_component,
            debt_type: raw.debt_type
          });
          return null;
        }
      } else {
        if (raw.debt_interest_rate != null ||
          raw.debt_payment_component != null ||
          raw.debt_type != null) {
          console.warn('parseBudgetGoal: Unexpected debt fields for non-debt goal:', {
            debt_interest_rate: raw.debt_interest_rate,
            debt_payment_component: raw.debt_payment_component,
            debt_type: raw.debt_type
          });
          return null;
        }
      }

      // Validate amount is a positive number
      if (raw.amount < 0) {
        console.warn('parseBudgetGoal: Invalid negative amount:', raw.amount);
        return null;
      }

      // Validate dates
      const targetDate = new Date(raw.target_date);
      if (isNaN(targetDate.getTime())) {
        console.warn('parseBudgetGoal: Invalid target date:', raw.target_date);
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
   * Updates goal spending recommendations and tracking data for multiple goals
   * @param budgetId The ID of the budget containing the goals
   * @param goalTrackings The tracking data to update
   */
  async updateGoalSpending(
    budgetId: string,
    goalRecommendations: BudgetGoalMultiRecommendations,
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
  private async onboardingAnalysisValidateOnboardingPrerequisites(budgetId: string): Promise<{ goals: BudgetGoal[] }> {
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

    // Get and validate goals if they exist
    const today = new Date().toISOString().split('T')[0]!;

    const validBudgetGoals = (await this.getBudgetGoals(budgetId))
      .map(goal => this.parseBudgetGoal(goal, (goal as any).fin_account_balance))
      .filter((goal): goal is BudgetGoal => goal !== null);

    // If we have goals, validate their target dates
    if (validBudgetGoals.length > 0) {
      const goalsWithPastDates = validBudgetGoals.filter(goal => {
        if (!goal.targetDate) return false;
        return goal.targetDate <= today;  // Simple string comparison
      });

      if (goalsWithPastDates.length > 0) {
        const goalNames = goalsWithPastDates.map(g => g.id).join(', ');
        throw new Error(`SERVER_ERROR:[validateBudgetReady] Goals must have future target dates: ${goalNames}`);
      }
    }

    return { goals: validBudgetGoals };
  }

  /**
   * 2. Collects transactions from all Plaid connections
   * Fetches existing transactions and syncs new ones from Plaid
   * @param budgetId - The ID of the budget to collect transactions for
   * @param plaidItems - Array of Plaid connection items to process
   * @param plaidClient - Initialized Plaid API client
   * @param manualInstitutionIds - Array of manual institution IDs to process
   * @returns Collection of transactions and cursor data
   */
  private async onboardingAnalysisCollectTransactions(
    budgetId: string,
    plaidItems: PlaidConnectionItemSummary[],
    plaidClient: PlaidApi,
    manualInstitutionIds: string[]
  ): Promise<OnboardingAnalysisTransactionCollection> {
    const result: OnboardingAnalysisTransactionCollection = {
      allTransactions: [],
      allRecurringTransactions: [],
      newTransactions: [],
      existingUnlinkedTransactions: [],
      existingUnlinkedRecurringTransactions: [],
      newUnlinkedTransactions: [],
      newRecurringTransactions: [],
      newUnlinkedRecurringTransactions: [],
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
    
    console.log('[Debug] After Plaid collection:', {
      allTransactionsCount: result.allTransactions.length,
      samplePlaid: result.allTransactions[0] ? {
        id: result.allTransactions[0].transaction.id,
        budgetFinAccountId: result.allTransactions[0].budgetFinAccountId,
        hasEnrichment: !!(result.allTransactions[0].transaction.plaidDetailedCategory)
      } : null
    });

    // Process each manual
    for (const institutionId of manualInstitutionIds) {
      console.log('[Debug] Before institution processing:', {
        institutionId,
        allTransactionsCount: result.allTransactions.length,
        allTransactionsRef: result.allTransactions
      });

      await this.onboardingAnalysisCollectManualInstitutionTransactions(
        institutionId,
        budgetId,
        result,
        plaidClient
      );

      console.log('[Debug] After institution processing:', {
        institutionId,
        allTransactionsCount: result.allTransactions.length,
        allTransactionsRef: result.allTransactions
      });
    }

    console.log('[Debug] After manual collection:', {
      allTransactionsCount: result.allTransactions.length,
      sampleManual: result.allTransactions[0] ? {
        id: result.allTransactions[0].transaction.id,
        budgetFinAccountId: result.allTransactions[0].budgetFinAccountId,
        hasEnrichment: !!(result.allTransactions[0].transaction.plaidDetailedCategory)
      } : null
    });

    return result;
  }

  /**
   * Helper function to implement retry logic with delay
   * @param operation Function to retry
   * @param maxRetries Maximum number of retry attempts
   * @param delayMs Delay between retries in milliseconds
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 2,
    delayMs: number = 3000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        if (attempt < maxRetries) {
          console.log(`Attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError;
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
      const existingTransactions = await this.onboardingAnalysisFetchPlaidItemTransactions(item.svendItemId, budgetId);
      console.log('[Debug] Fetched existing transactions:', {
        count: existingTransactions.length,
        sample: existingTransactions[0]?.fin_account_transactions?.[0]
      });

      // 2. Get Plaid account mappings
      const plaidAccountMappings = this.onboardingAnalysisGetPlaidAccountMappings(existingTransactions);
      console.log('[Debug] Plaid account mappings:', plaidAccountMappings);

      // 3. Process existing transactions
      await this.onboardingAnalysisProcessExistingTransactions(existingTransactions, result);

      // 4. Sync new transactions from Plaid with retry
      await this.retryOperation(async () => {
        await this.onboardingAnalysisSyncNewTransactions(item, plaidClient, plaidAccountMappings, result);
      });

      // Auto-generate userTxId for new transactions
      for (const tx of [...result.newTransactions, ...result.newUnlinkedTransactions]) {
        const transaction = 'transaction' in tx ? tx.transaction : tx;

        if (!transaction.userTxId && transaction.plaidTxId) {
          transaction.userTxId = await this.generateUserTxIdFromPlaidTx(transaction);
        }
      }

      // 5. Fetch existing recurring transactions
      const existingRecurringTransactions = await this.onboardingAnalysisFetchPlaidItemRecurringTransactions(item.svendItemId, budgetId);

      // 6. Process existing recurring transactions
      this.onboardingAnalysisProcessExistingRecurringTransactions(existingRecurringTransactions, result);

      // 7. Sync new recurring transactions from Plaid with retry
      await this.retryOperation(async () => {
        await this.onboardingAnalysisSyncNewRecurringTransactions(item, plaidClient, plaidAccountMappings, result);
      });

      // Auto-generate userTxId for new recurring transactions
      for (const tx of [...result.newRecurringTransactions, ...result.newUnlinkedRecurringTransactions]) {
        const transaction = 'transaction' in tx ? tx.transaction : tx;

        if (!transaction.userTxId && transaction.plaidTxId) {
          transaction.userTxId = await this.generateUserTxIdFromRecurringPlaidTx(transaction as FinAccountRecurringTransaction);
        }
      }
    } catch (error: any) {
      throw new Error(
        `Failed to process Plaid item ${item.svendItemId}: ${error.message}`
      );
    }
  }

  /**
     * Generates a unique user transaction ID for a given transaction
     * @param transaction The transaction needing a unique ID
     * @returns A promise resolving to a unique user transaction ID
     */
  private async generateUserTxIdFromPlaidTx(transaction: FinAccountTransaction): Promise<string> {
    let isUnique = false;
    let uniqueId: string | undefined;

    // Helper method to generate user_tx_id
    const generateUserTxId = (transaction: FinAccountTransaction): string => {
      const date = new Date(transaction.date);
      const formattedDate = date.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
      const plaidTxIdSuffix = transaction.plaidTxId?.slice(-6) || '000000'; // Last 6 of plaid_tx_id
      const randomCounter = Math.floor(Math.random() * 1000000).toString().padStart(6, '0'); // Random 6-digit number

      return `P${formattedDate}${randomCounter}${plaidTxIdSuffix}`;
    }

    while (!isUnique) {
      // Generate 10 potential IDs at once for efficiency
      const potentialIds = Array.from({ length: 10 }, () =>
        generateUserTxId(transaction)
      );

      // Check which IDs already exist in the database
      const { data: existingTxs } = await this.supabase
        .from('fin_account_transactions')
        .select('user_tx_id')
        .in('user_tx_id', potentialIds);

      // Find first ID that doesn't exist in database
      const existingIds = new Set(existingTxs?.map(tx => tx.user_tx_id));
      uniqueId = potentialIds.find(id => !existingIds.has(id));

      if (uniqueId) {
        isUnique = true;
      }
    }

    return uniqueId!;
  }

  /**
     * Generates a unique user transaction ID for a given recurring transaction
     * @param transaction The transaction needing a unique ID
     * @returns A promise resolving to a unique user transaction ID
     */
  private async generateUserTxIdFromRecurringPlaidTx(transaction: FinAccountRecurringTransaction): Promise<string> {
    let isUnique = false;
    let uniqueId: string | undefined;

    // Get the most recent date from plaid_raw_data.last_date or use current date
    const getMostRecentDate = (transaction: FinAccountRecurringTransaction): Date => {
      const lastDate = transaction.plaidRawData?.last_date;
      return lastDate ? new Date(lastDate) : new Date();
    };

    // Get date once
    const mostRecentDate = getMostRecentDate(transaction);
    const formattedDate = mostRecentDate.toISOString().slice(0, 10).replace(/-/g, '');
    const plaidTxIdSuffix = transaction.plaidTxId?.slice(-6) || '000000';

    while (!isUnique) {
      // Generate 10 IDs with the same date
      const potentialIds = Array.from({ length: 10 }, () => {
        const randomCounter = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
        return `P${formattedDate}${randomCounter}${plaidTxIdSuffix}`;
      });

      const { data: existingTxs, error: existingTxsError } = await this.supabase
        .from('fin_account_recurring_transactions')
        .select('user_tx_id')
        .in('user_tx_id', potentialIds);

      if (existingTxsError) {
        throw new Error(`[generateUserTxIdFromRecurringPlaidTx]:[generateUserTxId]: Failed to fetch recurring transaction IDs: ${existingTxsError.message}`);
      }

      const existingIds = new Set(existingTxs?.map(tx => tx.user_tx_id));
      uniqueId = potentialIds.find(id => !existingIds.has(id));

      if (uniqueId) {
        isUnique = true;
      }
    }

    return uniqueId!;
  }

  /**
   * 2.1 Collects transactions for a single manual institution
   * Part of the transaction collection process
   * @param institutionId - The institution to process
   * @param budgetId - The ID of the budget
   * @param result - Collection to store transaction results
   */
  private async onboardingAnalysisCollectManualInstitutionTransactions(
    institutionId: string,
    budgetId: string,
    result: OnboardingAnalysisTransactionCollection,
    plaidClient: PlaidApi
  ): Promise<void> {
    try {
      // 1. Fetch existing transactions
      const manualAccounts = await this.onboardingAnalysisFetchManualInstitutionTransactions(institutionId, budgetId);

      // 2. Enrich manual transactions with Plaid data
      const enrichedData = await Promise.all(
        manualAccounts.map(async account => {
          const enrichedTransactions = await this.transactionService.enrichManualTransactions(
            {
              [account.id]: {
                account: {
                  id: account.id,
                  type: account.type || 'depository',
                  source: 'svend',
                  institutionName: account.manual_fin_institutions?.name || '',
                  name: account.name || '',
                  mask: account.mask || '',
                  officialName: account.official_name || '',
                  balance: account.balance_current || 0
                },
                transactions: this.transactionService.parseTransactions(account.fin_account_transactions || [])
              }
            },
            plaidClient
          );

          // Update original transactions with enriched data
          const updatedTransactions = (account.fin_account_transactions || []).map(tx => {
            const enrichedTx = enrichedTransactions[account.id]?.find(et => et.userTxId === tx.user_tx_id);
            if (!enrichedTx) return tx;

            return {
              ...tx,
              manual_account_id: account.id,
              merchant_name: enrichedTx.merchantName || tx.merchant_name,
              plaid_detailed_category: enrichedTx.plaidDetailedCategory || undefined,
              plaid_category_confidence: enrichedTx.plaidCategoryConfidence || undefined,
              plaid_raw_data: enrichedTx.plaidRawData,
              iso_currency_code: tx.iso_currency_code || undefined,
              svend_category_id: tx.svend_category_id
            };
          });

          return {
            ...account,
            fin_account_transactions: updatedTransactions
          };
        })
      );

      // Use enrichedData instead of enrichedTransactions in subsequent steps
      manualAccounts.forEach((account, index) => {
        account.fin_account_transactions = enrichedData[index]?.fin_account_transactions as any;
      });

      // 4. Process existing transactions
      console.log('[Debug] About to call ProcessExistingTransactions:', {
        manualAccountsLength: manualAccounts.length,
        resultRef: result
      });

      try {
        await this.onboardingAnalysisProcessExistingTransactions(manualAccounts, result);

        console.log('[Debug] Successfully returned from ProcessExistingTransactions:', {
          allTransactionsCount: result.allTransactions.length,
          resultRef: result
        });
      } catch (error) {
        console.error('[Error] Failed in or after ProcessExistingTransactions:', error);
        throw error;
      }

      // Add debug log to watch allTransactions
      console.log('[Debug] One step later:', {
        allTransactionsCount: result.allTransactions.length
      });

      // 5. Process recurring patterns
      const recurringTransactions = await this.transactionService.processManualRecurringTransactions([
        ...result.allTransactions,
        ...result.existingUnlinkedTransactions.map(tx => ({
          transaction: tx,
          budgetFinAccountId: '',
          category: {
            id: tx.svendCategoryId || '',
            name: '',
            svendCategoryId: tx.svendCategoryId || '',
            isManual: true,
            isDiscretionary: false,
            createdAt: '',
            updatedAt: ''
          },
          categoryGroupId: '',
          categoryGroup: '',
          merchantName: tx.merchantName || '',
          payee: tx.payee || '',
          notes: '',
          budgetTags: [],
          budgetAttachmentsStorageNames: []
        }))
      ]);

      console.log('[Debug] After processManualRecurringTransactions:', {
        allTransactionsCount: result.allTransactions.length,
        recurringCount: recurringTransactions.length,
        sample: result.allTransactions[0] ? {
          id: result.allTransactions[0].transaction.id,
          budgetFinAccountId: result.allTransactions[0].budgetFinAccountId,
          hasEnrichment: !!(result.allTransactions[0].transaction.plaidDetailedCategory)
        } : null
      });

      // 6. Add recurring transactions to result
      for (const recurring of recurringTransactions) {
        if (recurring.budgetFinAccountId) {
          result.newRecurringTransactions.push(recurring);
          result.allRecurringTransactions.push(recurring);
        } else {
          result.newUnlinkedRecurringTransactions.push(recurring.transaction);
        }
      }
    } catch (error: any) {
      throw new Error(
        `Failed to process manual institution ${institutionId}: ${error.message}`
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
  private async onboardingAnalysisFetchPlaidItemTransactions(itemId: string, budgetId: string) {
    const { data: transactions, error } = await this.supabase
      .from('plaid_accounts')
      .select(`
        id,
        plaid_account_id,
        fin_account_transactions (*),
        budget_fin_accounts (id)
      `)
      .eq('plaid_conn_item_id', itemId)
      .eq('budget_fin_accounts.budget_id', budgetId);

    if (error) {
      throw new Error(`Failed to fetch existing transactions: ${error.message}`);
    }

    return transactions;
  }

  /**
   * 2.2 Fetches existing transactions from the database
   * Part of the transaction collection process
   * @param itemId - The ID of the Plaid connection item
   * @param budgetId - The ID of the budget
   * @returns Array of existing transactions from the database
   */
  private async onboardingAnalysisFetchPlaidItemRecurringTransactions(itemId: string, budgetId: string) {
    const { data: transactions, error } = await this.supabase
      .from('plaid_accounts')
      .select(`
        id,
        plaid_account_id,
        fin_account_recurring_transactions (*),
        budget_fin_accounts (id)
      `)
      .eq('plaid_conn_item_id', itemId)
      .eq('budget_fin_accounts.budget_id', budgetId);

    if (error) {
      throw new Error(`Failed to fetch existing transactions: ${error.message}`);
    }

    return transactions;
  }

  /**
   * 2.2 Fetches existing transactions from the database
   * Part of the transaction collection process
   * @param institutionId - The ID of the manual institution
   * @param budgetId - The ID of the budget
   * @returns Array of existing transactions from the database
   */
  private async onboardingAnalysisFetchManualInstitutionTransactions(institutionId: string, budgetId: string) {
    // const { data: transactions, error } = await this.supabase
    //   .from('manual_fin_accounts')
    //   .select(`
    //     *,
    //     manual_fin_institutions (name),
    //     fin_account_transactions (*),
    //     budget_fin_accounts!inner (id)
    //   `)
    //   .eq('institution_id', institutionId)
    //   .eq('budget_fin_accounts.budget_id', budgetId);

    // TODO: Remove query constraints to include unlinked transactions
    const { data: transactions, error } = await this.supabase
    .from('manual_fin_accounts')
    .select(`
      *,
      manual_fin_institutions (name),
      fin_account_transactions (*),
      budget_fin_accounts (id)
    `)
    .eq('institution_id', institutionId);

    if (error) {
      console.error('Error fetching manual transactions:', error);
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
   * @param dbExistingTransactions - Array of transactions from database
   * @param result - Collection to store processed transactions
   */
  private async onboardingAnalysisProcessExistingTransactions(
    dbExistingTransactions: any[],
    result: OnboardingAnalysisTransactionCollection
  ) {
    console.log('[Debug] Processing existing transactions:', {
      accountsCount: dbExistingTransactions.length,
      transactionsPerAccount: dbExistingTransactions.map(account => ({
        accountId: account.id,
        transactionCount: account.fin_account_transactions?.length || 0,
        budgetFinAccountId: account.budget_fin_accounts?.[0]?.id
      }))
    });

    const transactions = dbExistingTransactions
      .flatMap(account => {
        if (!account || !account.fin_account_transactions) {
          return [];
        }

        // Add debug log for manual accounts
        if (account.id && account.manual_fin_institutions) {
          console.log('[Manual Account Debug]', {
            accountId: account.id,
            institutionName: account.manual_fin_institutions.name,
            transactionCount: account.fin_account_transactions.length,
            sampleTransaction: account.fin_account_transactions[0] ? {
              id: account.fin_account_transactions[0].id,
              manual_account_id: account.fin_account_transactions[0].manual_account_id,
              amount: account.fin_account_transactions[0].amount
            } : null
          });
        }

        return account.fin_account_transactions.map((tx: any) => ({
          transaction: tx,
          budgetFinAccountId: account.budget_fin_accounts?.[0]?.id,
          category: tx.svend_category_id ? {
            id: tx.svend_category_id
          } : undefined
        }));
      })
      .filter(tx => tx.transaction)
      .map(tx => {
        if (tx.budgetFinAccountId) {
          const transformedTx = {
            ...tx,
            transaction: {
              ...tx.transaction,
              manualAccountId: tx.transaction.manual_account_id,
              plaidAccountId: tx.transaction.plaid_account_id,
              plaidDetailedCategory: tx.transaction.plaid_detailed_category,
              plaidCategoryConfidence: tx.transaction.plaid_category_confidence,
              plaidRawData: tx.transaction.plaid_raw_data,
              isoCurrencyCode: tx.transaction.iso_currency_code || 'USD',
              userTxId: tx.transaction.user_tx_id,
              plaidTxId: tx.transaction.plaid_tx_id,
              date: tx.transaction.date,
              amount: tx.transaction.amount,
              status: tx.transaction.tx_status || 'posted',
              merchantName: tx.transaction.merchant_name || '',
              payee: tx.transaction.payee || '',
              svendCategoryId: tx.transaction.svend_category_id
            }
          };

          return transformedTx;
        }
        // Convert snake_case DB fields to camelCase when adding to existingUnlinkedTransactions
        const unlinkedTx: FinAccountTransaction = {
          id: tx.transaction.id,
          date: tx.transaction.date,
          amount: tx.transaction.amount,
          status: tx.transaction.tx_status || 'posted',
          svendCategoryId: tx.transaction.svend_category_id,
          merchantName: tx.transaction.merchant_name || '',
          payee: tx.transaction.payee || '',
          plaidRawData: tx.transaction.plaid_raw_data,
          isoCurrencyCode: tx.transaction.iso_currency_code || 'USD',
          userTxId: tx.transaction.user_tx_id,
          plaidTxId: tx.transaction.plaid_tx_id,
          manualAccountId: tx.transaction.manual_account_id,
          plaidAccountId: tx.transaction.plaid_account_id,
          plaidDetailedCategory: tx.transaction.plaid_detailed_category,
          plaidCategoryConfidence: tx.transaction.plaid_category_confidence
        };
        result.existingUnlinkedTransactions.push(unlinkedTx);
        return null;
      })
      .filter((tx): tx is BudgetFinAccountTransaction => tx !== null);

    const { transactions: processedTransactions, error } =
      await this.transactionService.processPlaidCategories(transactions, []);

    console.log('[Debug] After processPlaidCategories:', {
      originalCount: transactions.length,
      processedCount: processedTransactions?.length || 0,
      error: error,
      allTransactionsCount: result.allTransactions.length  // Add this
    });

    if (error) {
      console.error('Error processing categories:', error);
      result.allTransactions.push(...transactions);
    } else if (processedTransactions) {
      result.allTransactions.push(...processedTransactions);
      console.log('[Debug] Right after push, before return:', {
        allTransactionsCount: result.allTransactions.length,
        isArray: Array.isArray(result.allTransactions),
        allTransactionsRef: result.allTransactions
      });
    }

    // Add debug log right after pushing to allTransactions
    console.log('[Debug] After adding to allTransactions:', {
      allTransactionsCount: result.allTransactions.length,
      sampleTransaction: result.allTransactions[0] ? {
        id: result.allTransactions[0].transaction.id,
        budgetFinAccountId: result.allTransactions[0].budgetFinAccountId,
        hasEnrichment: !!(result.allTransactions[0].transaction.plaidDetailedCategory)
      } : null
    });

    // Final summary log for manual transactions
    const manualTransactions = result.allTransactions.filter(tx => tx.transaction.manualAccountId);
    if (manualTransactions.length > 0) {
      console.log('[Manual Transactions Summary]', {
        totalCount: manualTransactions.length,
        withManualAccountId: manualTransactions.filter(tx => tx.transaction.manualAccountId).length,
        samples: manualTransactions.slice(0, 2).map(tx => ({
          id: tx.transaction.id,
          manualAccountId: tx.transaction.manualAccountId,
          budgetFinAccountId: tx.budgetFinAccountId,
          amount: tx.transaction.amount
        }))
      });
    }

    // After processing existing transactions
    console.log('[Debug] After processing existing:', {
      allTransactionsCount: result.allTransactions.length,
      sample: result.allTransactions[0] ? {
        id: result.allTransactions[0].transaction.id,
        budgetFinAccountId: result.allTransactions[0].budgetFinAccountId,
        hasEnrichment: !!(result.allTransactions[0].transaction.plaidDetailedCategory)
      } : null,
      resultKeys: Object.keys(result)
    });
  }

  /**
   * 2.4 Processes existing transactions into the result object
   * Part of the transaction collection process
   * @param dbExistingTransactions - Array of transactions from database
   * @param result - Collection to store processed transactions
   */
  private onboardingAnalysisProcessExistingRecurringTransactions(
    dbExistingTransactions: any[],
    result: OnboardingAnalysisTransactionCollection
  ) {
    const transactions = dbExistingTransactions
      .flatMap(account => {
        // Check if account and fin_account_recurring_transactions exist
        if (!account || !account.fin_account_recurring_transactions) {
          console.warn('Account or recurring transactions missing:', {
            accountId: account?.id,
            hasTransactions: !!account?.fin_account_recurring_transactions
          });
          return [];
        }

        return account.fin_account_recurring_transactions.map((transaction: any) => ({
          ...transaction,
          budgetFinAccountId: account.budget_fin_accounts?.[0]?.id
        }));
      })
      .filter(Boolean)
      .map(transaction => {
        // If it has a budgetFinAccountId, it's a linked transaction
        if (transaction.budgetFinAccountId) {
          result.allRecurringTransactions.push({
            transaction: {
              id: transaction.id,
              plaidAccountId: transaction.plaid_account_id,
              manualAccountId: transaction.manual_account_id,
              svendCategoryId: transaction.svend_category_id,
              userTxId: transaction.user_tx_id,
              plaidTxId: transaction.plaid_tx_id || undefined,
              plaidDetailedCategory: transaction.plaid_category_detailed,
              plaidCategoryConfidence: transaction.plaid_category_confidence,
              plaidTransactionIds: transaction.plaid_transaction_ids,
              finAccountTransactionIds: transaction.fin_account_transaction_ids,
              plaidRawData: transaction.plaid_raw_data,
              createdAt: transaction.created_at,
              updatedAt: transaction.updated_at
            } as FinAccountRecurringTransaction,
            budgetFinAccountId: transaction.budgetFinAccountId,
          } as BudgetFinAccountRecurringTransaction);
          return null;
        }

        // If no budgetFinAccountId, it's an unlinked transaction
        result.newUnlinkedRecurringTransactions.push({
          id: transaction.id,
          plaidAccountId: transaction.plaid_account_id,
          manualAccountId: transaction.manual_account_id,
          svendCategoryId: transaction.svend_category_id,
          userTxId: transaction.user_tx_id,
          plaidTxId: transaction.plaid_tx_id || undefined,
          plaidDetailedCategory: transaction.plaid_category_detailed,
          plaidCategoryConfidence: transaction.plaid_category_confidence,
          plaidTransactionIds: transaction.plaid_transaction_ids,
          finAccountTransactionIds: transaction.fin_account_transaction_ids,
          plaidRawData: transaction.plaid_raw_data,
          createdAt: transaction.created_at,
          updatedAt: transaction.updated_at
        } as FinAccountRecurringTransaction);
        return null;
      })
      .filter(Boolean);

    console.log('[Debug] Processed recurring transactions:', {
      allRecurringTransactions: result.allRecurringTransactions.length,
      newUnlinkedRecurringTransactions: result.newUnlinkedRecurringTransactions.length,
      sample: {
        linked: result.allRecurringTransactions[0]?.transaction?.id,
        unlinked: result.newUnlinkedRecurringTransactions[0]?.id
      }
    });
  }

  /**
   * 2.5 Syncs new transactions from Plaid
   * Next to last step of the transaction collection process
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
        access_token: item.accessToken,
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

          // filter out transactions associated with account that's not linked to the budget
          if (newTransaction.budgetFinAccountId) {
            result.newTransactions.push(newTransaction);
            result.allTransactions.push(newTransaction);
          } else {
            result.newUnlinkedTransactions.push(newTransaction.transaction);
          }
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
    transaction: Transaction,
    plaidCategory: string,
    plaidAccounts: any[]
  ): BudgetFinAccountTransaction {
    const matchingAccount = plaidAccounts?.find(
      account => account.plaid_account_id === transaction.account_id
    );

    return {
      transaction: {
        id: '',
        plaidTxId: transaction.transaction_id,
        date: transaction.date,
        amount: transaction.amount,
        plaidDetailedCategory: plaidCategory,
        plaidCategoryConfidence: transaction?.personal_finance_category?.confidence_level,
        plaidAccountId: matchingAccount?.id,
        merchantName: transaction.merchant_name ?? '',
        payee: transaction.payment_meta?.payee ?? '',
        status: transaction.pending ? 'pending' : 'posted',
        isoCurrencyCode: transaction.iso_currency_code,
        plaidRawData: transaction,
      } as FinAccountTransaction,
      budgetFinAccountId: matchingAccount?.budget_fin_account_id,
    } as BudgetFinAccountTransaction;
  }

  /**
   * 2.6 Syncs new recurring transactions from Plaid
   * Final step of the transaction collection process
   */
  private async onboardingAnalysisSyncNewRecurringTransactions(
    item: PlaidConnectionItemSummary,
    plaidClient: PlaidApi,
    plaidAccounts: any[],
    result: OnboardingAnalysisTransactionCollection
  ): Promise<void> {
    try {
      // Call Plaid's recurring transactions endpoint
      const response = await plaidClient.transactionsRecurringGet({
        access_token: item.accessToken,
        account_ids: plaidAccounts.map(acc => acc.plaid_account_id)
      });

      // Process inflow and outflow streams separately
      for (const stream of [...response.data.inflow_streams, ...response.data.outflow_streams]) {
        if (result.allRecurringTransactions.some(t => t.transaction.plaidTxId === stream.stream_id)) {
          continue;
        }

        const newRecurringTransaction = this.onboardingAnalysisCreateRecurringTransactionFromPlaid(
          stream,
          plaidAccounts
        );

        if (newRecurringTransaction) {
          if (newRecurringTransaction.budgetFinAccountId) {
            result.newRecurringTransactions.push(newRecurringTransaction);
            result.allRecurringTransactions.push(newRecurringTransaction);
          } else {
            result.newUnlinkedRecurringTransactions.push(newRecurringTransaction.transaction);
          }
        }
      }
    } catch (error: any) {
      console.error('Error syncing recurring transactions:', error);
      throw new Error(`Failed to sync recurring transactions: ${error.message}`);
    }
  }

  private onboardingAnalysisCreateRecurringTransactionFromPlaid(
    stream: TransactionStream,
    plaidAccounts: any[]
  ): BudgetFinAccountRecurringTransaction | null {
    try {
      // Find matching account
      const matchingAccount = plaidAccounts?.find(
        account => account.plaid_account_id === stream.account_id
      );
      if (!matchingAccount) {
        console.warn('No matching account found for stream:', stream.stream_id);
        return null;
      }

      return {
        transaction: {
          id: '',
          userTxId: '',
          plaidTxId: stream.stream_id,
          plaidAccountId: matchingAccount.id,
          plaidDetailedCategory: stream.personal_finance_category?.detailed,
          plaidCategoryConfidence: stream.personal_finance_category?.confidence_level,
          plaidTransactionIds: stream.transaction_ids,
          finAccountTransactionIds: [],
          plaidRawData: stream
        } as FinAccountRecurringTransaction,
        budgetFinAccountId: matchingAccount?.budget_fin_account_id,
      } as BudgetFinAccountRecurringTransaction;
    } catch (error: any) {
      console.error('Error creating recurring transaction from Plaid data:', error);
      return null;
    }
  }

  /**
   * 3. Maps Plaid categories to Svend categories and processes transactions
   */
  private async onboardingAnalysisProcessCategories(
    transactionData: OnboardingAnalysisTransactionCollection
  ): Promise<{ transactionData?: OnboardingAnalysisTransactionCollection, error?: string }> {
    try {
      const categoryService = createCategoryService(this.supabase);

      // Get both Plaid category mappings and all Svend categories
      const uniquePlaidCategories = [...new Set([
        ...transactionData.allTransactions.map(t => t.transaction.plaidDetailedCategory),
        ...transactionData.allRecurringTransactions.map(t => t.transaction.plaidDetailedCategory),
        ...transactionData.newUnlinkedTransactions.map(t => t.plaidDetailedCategory),
        ...transactionData.newUnlinkedRecurringTransactions.map(t => t.plaidDetailedCategory)
      ].filter((cat): cat is string => !!cat))];

      // Get both mappings and all categories
      const [plaidMappings, svendCategories] = await Promise.all([
        categoryService.mapPlaidCategoriesToSvendCategories(uniquePlaidCategories),
        categoryService.getSvendDefaultCategoryGroups()
      ]);

      if (!plaidMappings || !svendCategories) {
        throw new Error('Category mapping or categories fetch returned null or undefined');
      }

      // Helper function to find category by Svend ID
      const findCategoryBySvendId = (svendCategoryId: string) => {
        return Object.values(svendCategories).reduce((found, group) => {
          if (found) return found;
          const category = group.categories.find(cat => cat.id === svendCategoryId);
          if (category) {
            return {
              category,
              groupName: group.name,
              groupId: group.id
            };
          }
          return null as { category: any; groupName: string; groupId: string; } | null;
        }, null as { category: any; groupName: string; groupId: string; } | null);
      };

      // Helper function to find category by Plaid category name
      const findCategoryByPlaidCategory = (plaidCategory: string) => {
        // Find the category in svendCategories using the mapped name from plaidMappings
        const mappedName = plaidMappings[plaidCategory]?.name;
        if (!mappedName) return null;

        // Find the group containing this category name
        const group = Object.values(svendCategories).find(group =>
          group.categories.some(cat => cat.name === mappedName)
        );
        if (!group) return null;

        const category = group.categories.find(cat => cat.name === mappedName);
        if (!category) return null;

        return {
          category,
          groupName: group.name,
          groupId: group.id
        };
      };

      // Helper function to map categories for budget transactions
      const mapBudgetTransactionCategories = (
        transactions: BudgetFinAccountTransaction[]
      ): BudgetFinAccountTransaction[] => {
        return transactions.map(transaction => {
          // Check for either manual account or svendCategoryId
          if (transaction.transaction.manualAccountId || transaction.transaction.svendCategoryId) {
            const svendCategoryId = transaction.transaction.svendCategoryId;
            if (!svendCategoryId) {
              // Only log summary of missing categories instead of each transaction
              return transaction;
            }

            const mappedCategory = findCategoryBySvendId(svendCategoryId);
            if (!mappedCategory) {
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
          }

          // For Plaid transactions
          const plaidCategory = transaction.transaction.plaidDetailedCategory;
          if (!plaidCategory) {
            return transaction;
          }

          const mappedCategory = findCategoryByPlaidCategory(plaidCategory);
          if (!mappedCategory) {
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
      };

      // Helper function to map categories for unlinked transactions
      const mapUnlinkedTransactionCategories = (
        transactions: FinAccountTransaction[]
      ): FinAccountTransaction[] => {
        return transactions.map(transaction => {
          if (transaction.manualAccountId || transaction.svendCategoryId) {
            if (!transaction.svendCategoryId) {
              return transaction;
            }

            const mappedCategory = findCategoryBySvendId(transaction.svendCategoryId);
            if (!mappedCategory) {
              return transaction;
            }

            return {
              ...transaction,
              svendCategoryId: mappedCategory.category.id,
              categoryGroup: mappedCategory.groupName,
              categoryGroupId: mappedCategory.groupId
            };
          }

          const plaidCategory = transaction.plaidDetailedCategory;
          if (!plaidCategory) {
            return transaction;
          }

          const mappedCategory = findCategoryByPlaidCategory(plaidCategory);
          if (!mappedCategory) {
            return transaction;
          }

          return {
            ...transaction,
            svendCategoryId: mappedCategory.category.id,
            categoryGroup: mappedCategory.groupName,
            categoryGroupId: mappedCategory.groupId
          };
        });
      };

      // Add these two functions for recurring transactions:
      const mapBudgetRecurringTransactionCategories = (
        transactions: BudgetFinAccountRecurringTransaction[]
      ): BudgetFinAccountRecurringTransaction[] => {
        return transactions.map(transaction => {
          const isManual = !!transaction.transaction.manualAccountId;

          // For manual transactions, copy category from original transaction
          if (isManual) {
            // Find original transaction in allTransactions to get its category
            const originalTx = transactionData.allTransactions.find(tx => 
              tx.transaction.userTxId === transaction.transaction.userTxId
            );

            if (!originalTx?.category) {
              console.warn('Missing category for manual recurring transaction:', {
                userTxId: transaction.transaction.userTxId,
                originalTx: originalTx ? {
                  category: originalTx.category,
                  svendCategoryId: originalTx.transaction.svendCategoryId
                } : null
              });
              return transaction;
            }

            return {
              ...transaction,
              transaction: {
                ...transaction.transaction,
                svendCategoryId: originalTx.category.id,
              },
              categoryId: originalTx.category.id,
              category: originalTx.category.name,
              categoryGroup: originalTx.categoryGroup,
              categoryGroupId: originalTx.categoryGroupId
            };
          }

          // For Plaid transactions, use plaid category mapping
          const plaidCategory = transaction.transaction.plaidDetailedCategory;
          if (!plaidCategory) {
            return transaction;
          }

          const mappedCategory = findCategoryByPlaidCategory(plaidCategory);
          if (!mappedCategory) {
            return transaction;
          }

          return {
            ...transaction,
            transaction: {
              ...transaction.transaction,
              svendCategoryId: mappedCategory.category.id,
            },
            categoryId: mappedCategory.category.id,
            category: mappedCategory.category.name,
            categoryGroup: mappedCategory.groupName,
            categoryGroupId: mappedCategory.groupId
          };
        });
      };

      const mapUnlinkedRecurringTransactionCategories = (
        transactions: FinAccountRecurringTransaction[]
      ): FinAccountRecurringTransaction[] => {
        return transactions.map(transaction => {
          if (transaction.manualAccountId || transaction.svendCategoryId) {
            if (!transaction.svendCategoryId) {
              return transaction;
            }

            const mappedCategory = findCategoryBySvendId(transaction.svendCategoryId);
            if (!mappedCategory) {
              return transaction;
            }

            return {
              ...transaction,
              svendCategoryId: mappedCategory.category.id,
              categoryGroup: mappedCategory.groupName,
              categoryGroupId: mappedCategory.groupId
            };
          }

          const plaidCategory = transaction.plaidDetailedCategory;
          if (!plaidCategory) {
            return transaction;
          }

          const mappedCategory = findCategoryByPlaidCategory(plaidCategory);
          if (!mappedCategory) {
            return transaction;
          }

          return {
            ...transaction,
            svendCategoryId: mappedCategory.category.id,
            categoryGroup: mappedCategory.groupName,
            categoryGroupId: mappedCategory.groupId
          };
        });
      };

      // Helper function to sort transactions by date
      const sortTransactionsByDate = <T extends { transaction: { date: string } }>(
        transactions: T[]
      ): T[] => {
        return [...transactions].sort((a, b) =>
          new Date(a.transaction.date).getTime() - new Date(b.transaction.date).getTime()
        );
      };

      // Process regular transactions
      const processedTransactions = mapBudgetTransactionCategories(transactionData.allTransactions);
      console.log('[Debug] After category mapping:', {
        sampleTx: processedTransactions[0]?.transaction?.id,
        totalTxs: processedTransactions.length
      });

      // Only sort if we have new processed transactions
      if (processedTransactions?.length > 0) {
        transactionData.allTransactions = sortTransactionsByDate(processedTransactions);
      }
      console.log('[Debug] After sorting:', {
        sampleTx: transactionData.allTransactions[0]?.transaction?.id,
        totalTxs: transactionData.allTransactions.length
      });

      // Process new transactions
      transactionData.newTransactions = sortTransactionsByDate(
        mapBudgetTransactionCategories(transactionData.newTransactions)
      );
      console.log('[Debug] After new transactions:', {
        sampleTx: transactionData.newTransactions[0]?.transaction?.id,
        totalTxs: transactionData.newTransactions.length
      });

      // Process unlinked transactions
      transactionData.newUnlinkedTransactions = mapUnlinkedTransactionCategories(
        transactionData.newUnlinkedTransactions
      );

      // Now process recurring transactions after all regular transactions are processed
      transactionData.newRecurringTransactions = transactionData.newRecurringTransactions.map(rt => {
        const isManual = !rt.transaction.plaidTxId;
        
        if (isManual) {
          // For manual recurring transactions, find the original transaction by ID
          const originalTx = transactionData.allTransactions.find(tx => 
            rt.transaction.finAccountTransactionIds?.includes(tx.transaction.id)
          );

          // If no match found but recurring transaction has a category, use that
          if (!originalTx?.transaction.svendCategoryId && rt.transaction.svendCategoryId) {
            return rt;
          }

          // If no category found at all, log and continue
          if (!originalTx?.transaction.svendCategoryId) {
            console.warn('[Warning] No category found for manual recurring transaction:', {
              userTxId: rt.transaction.userTxId,
              finAccountTransactionIds: rt.transaction.finAccountTransactionIds,
              matchAttempt: originalTx ? {
                id: originalTx.transaction.id,
                svendCategoryId: originalTx.transaction.svendCategoryId
              } : null
            });
            return rt;
          }

          return {
            ...rt,
            transaction: {
              ...rt.transaction,
              svendCategoryId: originalTx.transaction.svendCategoryId
            }
          };
        }
        return rt;
      });

      // Finally process unlinked recurring transactions
      transactionData.newUnlinkedRecurringTransactions = mapUnlinkedRecurringTransactionCategories(
        transactionData.newUnlinkedRecurringTransactions
      );

      // Process recurring transactions
      transactionData.newRecurringTransactions = mapBudgetRecurringTransactionCategories(
        transactionData.newRecurringTransactions
      );

      // Log any missing categories
      const missingCategories = processedTransactions.filter(tx => !tx.category?.id);
      if (missingCategories.length > 0) {
        console.log(`[Budget] ${missingCategories.length} transactions missing categories`);
      }

      return { transactionData };
    } catch (error: any) {
      console.error('[Budget] Error processing categories:', error);
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
      const monthlyCategorySpending: Record<string, number> = {};

      transactions.forEach(budgetTransaction => {
        if (!budgetTransaction.category?.name) {
          console.warn('Transaction missing mapped category:', {
            date: budgetTransaction.transaction.date,
            amount: budgetTransaction.transaction.amount,
            category: budgetTransaction.category?.name,
            categoryGroup: budgetTransaction.categoryGroup
          });
          return;
        }

        // Use the mapped category name instead of plaidCategory
        const categoryName = budgetTransaction.category?.name;
        const isIncome = budgetTransaction.categoryGroup?.toLowerCase() === 'income';
        const amount = isIncome ? -Math.abs(budgetTransaction.transaction.amount) : Math.abs(budgetTransaction.transaction.amount);
        monthlyCategorySpending[categoryName] = (monthlyCategorySpending[categoryName] || 0) + amount;
      });

      // Initialize Income category if it doesn't exist
      if (!monthlyCategorySpending.Income) {
        monthlyCategorySpending.Income = 0;
      }

      // Calculate spending analysis
      const totalIncome = Math.abs(monthlyCategorySpending.Income || 0);
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
    transactionData: OnboardingAnalysisTransactionCollection,
    plaidItems: PlaidConnectionItemSummary[]
  ): Promise<void> {
    try {
      console.log('[Debug] PersistData received:', {
        allTransactionsCount: transactionData.allTransactions.length,
        sampleAllTx: transactionData.allTransactions[0] ? {
          id: transactionData.allTransactions[0].transaction.id,
          budgetFinAccountId: transactionData.allTransactions[0].budgetFinAccountId,
          hasEnrichment: !!(transactionData.allTransactions[0].transaction.plaidDetailedCategory)
        } : null
      });

      console.log('[Debug] Before save:', {
        sampleNewTx: transactionData.newTransactions[0]?.transaction,
        sampleAllTx: transactionData.allTransactions[0]?.transaction
      });

      // Step 1: Save new transactions
      const { error: saveError } = await this.onboardingAnalysisSaveTransactions(
        transactionData,
        budgetId
      );
      if (saveError) {
        throw new Error(saveError);
      }

      // Step 2: Update Plaid cursors
      const { error: cursorError } = await this.onboardingAnalysisUpdateCursors(
        plaidItems,
        transactionData.itemCursors
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
   * @param newRecurringTransactions - Array of recurring transactions to save
   * @param budgetId - The ID of the budget
   * @returns Object containing optional error message
   */
  private async onboardingAnalysisSaveTransactions(
    transactionData: OnboardingAnalysisTransactionCollection,
    budgetId: string
  ): Promise<{ error?: string }> {
    try {
      console.log('[Debug] Saving transactions:', {
        newTransactions: transactionData.newTransactions.slice(0, 3).map(tx => ({
          id: tx.transaction.id,
          userTxId: tx.transaction.userTxId,
          plaidTxId: tx.transaction.plaidTxId
        })),
        newRecurringTransactions: transactionData.newRecurringTransactions.slice(0, 3).map(tx => ({
          id: tx.transaction.id,
          userTxId: tx.transaction.userTxId,
          plaidTxId: tx.transaction.plaidTxId
        }))
      });

      // First, save all regular transactions (both budget and unlinked)
      console.warn(`budget service > onboarding analysis > persisting ${transactionData.newTransactions.length} budget transactions and ${transactionData.newUnlinkedTransactions.length} unlinked transactions..`);

      console.log('[Debug] About to save:', {
        sampleTransaction: transactionData.newUnlinkedTransactions[0],
        totalToSave: transactionData.newUnlinkedTransactions.length
      });

      // Save regular transactions first
      if (transactionData.allTransactions.length > 0) {
        const { error: saveTxError } = await this.transactionService.saveBudgetTransactions(
          transactionData.allTransactions,
          budgetId
        );
        if (saveTxError) return { error: saveTxError };
      }

      // Save unlinked transactions
      console.log('[Debug] Unlinked transactions to save:', {
        count: transactionData.newUnlinkedTransactions.length,
        sample: transactionData.newUnlinkedTransactions.slice(0, 2).map(tx => ({
          id: tx.id,
          plaidTxId: tx.plaidTxId,
          userTxId: tx.userTxId,
          date: tx.date
        }))
      });
      
      if (transactionData.existingUnlinkedTransactions.length > 0) {
        console.log('[Debug] About to save:', {
          sampleTransaction: transactionData.newUnlinkedTransactions[0],
          totalToSave: transactionData.newUnlinkedTransactions.length
        });

        const { error } = await this.transactionService.saveTransactions(
          transactionData.existingUnlinkedTransactions.map(tx => ({
            id: tx.id,
            date: tx.date,
            amount: tx.amount,
            status: tx.status || 'posted',
            svendCategoryId: tx.svendCategoryId,
            merchantName: tx.merchantName || '',
            payee: tx.payee || '',
            plaidRawData: tx.plaidRawData || undefined,
            isoCurrencyCode: tx.isoCurrencyCode || 'USD',
            userTxId: tx.userTxId,
            plaidTxId: tx.plaidTxId,
            manualAccountId: tx.manualAccountId,
            plaidAccountId: tx.plaidAccountId,
            plaidDetailedCategory: tx.plaidDetailedCategory,
            plaidCategoryConfidence: tx.plaidCategoryConfidence
          } as FinAccountTransaction))
        );

        if (error) {
          throw new Error(`Error inserting transactions: ${JSON.stringify(error)}`);
        }
      }

      // Get all transaction IDs from recurring transactions
      const plaidTxIds = [
        ...transactionData.newRecurringTransactions.flatMap(rt => 
          !rt.transaction.manualAccountId ? (rt.transaction.plaidRawData?.transaction_ids || []) : []
        ),
        ...transactionData.newUnlinkedRecurringTransactions.flatMap(rt =>
          !rt.manualAccountId ? (rt.plaidRawData?.transaction_ids || []) : []
        )
      ];

      const manualTxIds = [
        ...transactionData.newRecurringTransactions.flatMap(rt => 
          rt.transaction.manualAccountId ? rt.transaction.finAccountTransactionIds || [] : []
        ),
        ...transactionData.newUnlinkedRecurringTransactions.flatMap(rt =>
          rt.manualAccountId ? [rt.id] : []
        )
      ];

      console.log('[Debug] Transaction IDs:', {
        plaidIds: plaidTxIds,
        manualIds: manualTxIds,
        recurringTransactions: transactionData.newRecurringTransactions.map(rt => ({
          isManual: !!rt.transaction.manualAccountId,
          details: rt.transaction.manualAccountId ? {
            id: rt.transaction.id,
            finAccountTransactionIds: rt.transaction.finAccountTransactionIds
          } : {
            plaidTxId: rt.transaction.plaidTxId,
            finAccountTransactionIds: rt.transaction.finAccountTransactionIds
          }
        }))
      });

      // Query database for both Plaid and manual transaction IDs
      const { data: dbTransactions, error: queryError } = await this.supabase
        .from('fin_account_transactions')
        .select('id, plaid_tx_id');

      if (queryError) {
        console.error('[Error] Failed to query transactions:', queryError);
        throw new Error(`Failed to query transactions: ${queryError.message}`);
      }

      // Create mapping from both Plaid transaction IDs and direct IDs
      const txToDbIdMap = new Map<string, string>();
      
      // First map Plaid IDs to database IDs
      dbTransactions?.filter(tx => tx.plaid_tx_id).forEach(tx => {
        txToDbIdMap.set(tx.plaid_tx_id!, tx.id);
      });
      
      // Then map database IDs to themselves
      dbTransactions?.forEach(tx => {
        txToDbIdMap.set(tx.id, tx.id);
      });

      console.log('[Debug] ID Mapping:', {
        plaidMappings: dbTransactions?.filter(tx => tx.plaid_tx_id).map(tx => ({ 
          plaidId: tx.plaid_tx_id, 
          dbId: tx.id 
        })),
        totalMappings: txToDbIdMap.size
      });

      transactionData.newRecurringTransactions = transactionData.newRecurringTransactions.map(rt => {
        const isManual = !rt.transaction.plaidTxId;
        
        if (isManual) {
          // For manual recurring transactions, try to find the original transaction by ID
          const originalTx = transactionData.allTransactions.find(tx => 
            // Try matching by multiple possible IDs
            tx.transaction.id === rt.transaction.userTxId || 
            tx.transaction.userTxId === rt.transaction.userTxId ||
            (rt.transaction.finAccountTransactionIds || []).includes(tx.transaction.id)
          );

          if (!originalTx?.transaction.svendCategoryId) {
            // If no match found, try to use the category from the recurring transaction itself
            if (rt.transaction.svendCategoryId) {
              return rt;
            }

            console.error('[Error] No category found for manual recurring transaction:', {
              recurring: {
                userTxId: rt.transaction.userTxId,
                finAccountTransactionIds: rt.transaction.finAccountTransactionIds,
                svendCategoryId: rt.transaction.svendCategoryId
              },
              matchAttempts: transactionData.allTransactions.slice(0, 3).map(tx => ({
                id: tx.transaction.id,
                userTxId: tx.transaction.userTxId,
                svendCategoryId: tx.transaction.svendCategoryId
              }))
            });
            
            throw new Error(`Missing category ID for manual recurring transaction ${rt.transaction.userTxId}`);
          }

          return {
            ...rt,
            transaction: {
              ...rt.transaction,
              finAccountTransactionIds: rt.transaction.finAccountTransactionIds || [],
              svendCategoryId: originalTx.transaction.svendCategoryId
            }
          };
        }

        // For Plaid recurring transactions, map the transaction IDs
        const plaidTransactionIds = rt.transaction.plaidRawData?.transaction_ids || [];
        const finAccountTransactionIds = plaidTransactionIds
          .map(plaidId => txToDbIdMap.get(plaidId))
          .filter((id): id is string => !!id);

        return {
          ...rt,
          transaction: {
            ...rt.transaction,
            finAccountTransactionIds,
            svendCategoryId: rt.transaction.svendCategoryId
          }
        };
      });

      // Update unlinked plaid recurring transactions with the correct fin_account_transaction_ids
      transactionData.newUnlinkedRecurringTransactions = transactionData.newUnlinkedRecurringTransactions.map(rt => {
        const plaidTransactionIds = rt.plaidRawData?.transaction_ids || [];
        const finAccountTransactionIds = plaidTransactionIds
          .map(plaidId => txToDbIdMap.get(plaidId))
          .filter((id): id is string => !!id);

        if (finAccountTransactionIds.length !== plaidTransactionIds.length) {
          console.warn(
            'Not all Plaid transactions mapped for unlinked recurring transaction:',
            {
              plaidTransactionIds,
              mappedIds: finAccountTransactionIds,
              unmappedIds: plaidTransactionIds.filter(id => !txToDbIdMap.has(id)),
              dbMappings: Object.fromEntries(txToDbIdMap)
            }
          );
        }

        return {
          ...rt,
          finAccountTransactionIds
        };
      });

      // Now save recurring transactions with the mapped IDs
      console.log('[Debug] Before saving recurring transactions:', {
        newRecurringCount: transactionData.newRecurringTransactions.length,
        unlinkedRecurringCount: transactionData.newUnlinkedRecurringTransactions.length,
        sampleUnlinked: transactionData.newUnlinkedRecurringTransactions[0] ? {
          userTxId: transactionData.newUnlinkedRecurringTransactions[0].userTxId,
          finAccountTransactionIds: transactionData.newUnlinkedRecurringTransactions[0].finAccountTransactionIds,
          svendCategoryId: transactionData.newUnlinkedRecurringTransactions[0].svendCategoryId,
          isManual: !!transactionData.newUnlinkedRecurringTransactions[0].manualAccountId
        } : null
      });

      // Then merge recurring transactions
      if (transactionData.newRecurringTransactions.length > 0) {
        const { error: mergeError } = await this.transactionService.mergeBudgetFinAccountRecurringTransaction(
          transactionData.newRecurringTransactions,
          budgetId
        );
        if (mergeError) return { error: mergeError };
      }

      const { error: unlinkedRecurringError } = await this.transactionService.mergeFinAccountRecurringTransactions(
        transactionData.newUnlinkedRecurringTransactions
      );
      if (unlinkedRecurringError) throw new Error(unlinkedRecurringError);

      return { error: undefined };
    } catch (error: any) {
      console.error('Full error details:', error);
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
    plaidConfiguration: Configuration,
    manualInstitutionIds: string[]
  ): Promise<ServiceResult<OnboardingRecommendSpendingAndGoalsResult>> {
    try {
      // 1. Validation & Setup
      const { goals: validBudgetGoals } = await this.onboardingAnalysisValidateOnboardingPrerequisites(budgetId);
      const plaidClient = new PlaidApi(plaidConfiguration);

      // 2. Transaction Collection
      const transactionData = await this.onboardingAnalysisCollectTransactions(
        budgetId,
        plaidConnectionItems,
        plaidClient,
        manualInstitutionIds
      );

      console.log('Transaction Data Analysis:', {
        totalTransactions: transactionData.allTransactions.length,
        newTransactions: transactionData.newTransactions.length,
        newUnlinkedTransactions: transactionData.newUnlinkedTransactions.length,
        sampleTransaction: transactionData.allTransactions[0],
        totalRecurringTransactions: transactionData.allRecurringTransactions.length,
        newRecurringTransactions: transactionData.newRecurringTransactions.length,
        newUnlinkedRecurringTransactions: transactionData.newUnlinkedRecurringTransactions.length,
      });

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
        transactionData,
        plaidConnectionItems
      );

      // 6. Recommendations Generation
      const categoryGroups = await this.categoryService.getBudgetCategoryGroups(budgetId);

      const recommendationsResult = await this.onboardingRecommendSpendingAndGoals(
        transactionData.allTransactions,
        validBudgetGoals,
        categoryGroups,
        budgetId
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

    // Get total monthly goals amount
    const totalMonthlyGoals = Object.values(goalRecommendations)
      .reduce((sum, goal) => {
        const firstMonth = Object.keys(goal.monthlyAmounts)[0];
        if (!firstMonth) return sum;
        return sum + (goal.monthlyAmounts[firstMonth] || 0);
      }, 0);

    if (totalMonthlyGoals <= availableAfterSpending) {
      // We have enough funds - keep original timeline but recalculate amounts
      Object.values(goalRecommendations).forEach(goalRec => {
        const originalMonths = Object.keys(goalRec.monthlyAmounts).sort();
        const totalNeeded = Object.values(goalRec.monthlyAmounts)
          .reduce((sum, amt) => sum + amt, 0);
        const monthCount = originalMonths.length;

        // Use helper to calculate monthly allocations
        const monthlyAllocations = this.calculateMonthlyAllocationsWithRemainder(
          totalNeeded,
          monthCount
        );

        // Create new monthly amounts with original timeline
        const newMonthlyAmounts: Record<string, number> = {};

        // Generate months
        originalMonths.forEach((monthKey, i) => {
          newMonthlyAmounts[monthKey] = monthlyAllocations[i]!;
        });

        goalRec.monthlyAmounts = newMonthlyAmounts;
      });
    } else {
      // Not enough funds - need to extend timeline
      Object.values(goalRecommendations).forEach(goalRec => {
        const originalMonths = Object.keys(goalRec.monthlyAmounts).sort();
        if (originalMonths.length === 0) return;

        const totalNeeded = Object.values(goalRec.monthlyAmounts)
          .reduce((sum, amt) => sum + amt, 0);

        // Calculate proportion of available funds for this goal
        const firstMonth = originalMonths[0]!;
        const originalMonthlyAmount = goalRec.monthlyAmounts[firstMonth]!;
        const proportion = originalMonthlyAmount / totalMonthlyGoals;
        const availableForGoal = availableAfterSpending * proportion;

        // Calculate needed months with available funds
        const monthsNeeded = Math.ceil(totalNeeded / availableForGoal);
        const actualMonthCount = Math.max(originalMonths.length, monthsNeeded);

        // Use helper to calculate monthly allocations
        const monthlyAllocations = this.calculateMonthlyAllocationsWithRemainder(
          totalNeeded,
          actualMonthCount
        );

        // Create new monthly amounts with extended timeline
        const newMonthlyAmounts: Record<string, number> = {};

        // Parse starting date from first original month
        const [startYear, startMonth] = originalMonths[0]!.split('-').map(Number);

        // Generate all months
        for (let i = 0; i < actualMonthCount; i++) {
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
    categoryGroups: BudgetCategoryGroups
  ): Promise<{
    discretionaryCategories: string[],
    categoryToGroupMap: Record<string, string>
  }> {
    // Define discretionary categories
    const discretionaryCategories = Object.values(categoryGroups)
      .flatMap(group => group.categories.filter(cat => cat.isDiscretionary))
      .map(cat => cat.name);

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
    categoryGroups: BudgetCategoryGroups,
    categoryToGroupMap: Record<string, string>
  ): {
    totalIncome: number,
    totalDiscretionarySpending: number,
    totalNonDiscretionarySpending: number,
    initialSpendingRecommendations: BudgetSpendingRecommendations
  } {
    // Aggregate transactions by category for the rolling month
    const latestRollingMonthCategorySpending = latestRollingMonthTransactions.reduce((acc, budgetTransaction) => {
      const category = budgetTransaction.category?.name;
      acc[category] = (acc[category] || 0) + budgetTransaction.transaction.amount;
      return acc;
    }, {} as Record<string, number>);

    // Ensure income is treated as a positive number for calculations
    const totalIncome = Math.abs(latestRollingMonthCategorySpending.Income || 0);

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
    goalSpendingRecommendations: BudgetGoalMultiRecommendations,
    goalSpendingTrackings: Record<string, BudgetGoalSpendingTrackingsByMonth>
  } {
    // Create strategy-specific recommendations
    const spendingRecommendations: BudgetSpendingRecommendations = {
      balanced: initialSpendingRecommendations.balanced,
      conservative: initialSpendingRecommendations.conservative,
      relaxed: initialSpendingRecommendations.relaxed
    };

    // Initialize goal recommendations for all strategies
    const goalSpendingRecommendations: BudgetGoalMultiRecommendations = {
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

      // Get adjusted target day for current month
      const currentMonthLastDay = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0
      ).getDate();
      const adjustedTargetDay = Math.min(targetDayOfMonth, currentMonthLastDay);

      // Initialize start date at beginning of current month
      const currentDate = new Date(today);
      currentDate.setDate(1); // Reset to start of month for clean iteration

      // Determine if we need to start next month based on adjusted target day
      if (today.getDate() >= adjustedTargetDay) {
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      // Calculate months between start and target
      const startYear = currentDate.getFullYear();
      const startMonth = currentDate.getMonth();
      const endYear = targetDate.getFullYear();
      const endMonth = targetDate.getMonth();

      // Calculate total months including both start and end months
      const monthsUntilTarget = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;

      // Calculate monthly amount
      const monthlyAmount = goal.amount / monthsUntilTarget;
      const monthlyAmounts: Record<string, number> = {};

      // Generate monthly dates with proper day of month handling
      for (let i = 0; i < monthsUntilTarget; i++) {
        // Get last day of current month
        const lastDayOfMonth = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          0
        ).getDate();

        // Use target day unless it exceeds month length
        const adjustedDay = Math.min(targetDayOfMonth, lastDayOfMonth);
        currentDate.setDate(adjustedDay);

        // Format as YYYY-MM
        const monthKey = currentDate.toISOString().slice(0, 7);
        monthlyAmounts[monthKey] = monthlyAmount;

        // Move to first day of next month
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentDate.setDate(1);
      }

      // Set recommendations for each strategy
      ['balanced', 'conservative', 'relaxed'].forEach(strategy => {
        goalSpendingRecommendations[strategy as keyof BudgetGoalMultiRecommendations][goal.id] = {
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
        groupTracking.categories.forEach(categoryTracking => {
          categoryTracking.spendingActual = Math.round(categoryTracking.spendingActual * 100) / 100;
        });
      });
    });

    // Round goal recommendations for all strategies
    ['balanced', 'conservative', 'relaxed'].forEach(strategy => {
      const strategyRecs = results.goalSpendingRecommendations![strategy as keyof BudgetGoalMultiRecommendations];
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
   * @returns ServiceResult containing analysis results or error
   */
  async onboardingRecommendSpendingAndGoals(
    transactions: BudgetFinAccountTransaction[],
    goals: BudgetGoal[],
    categoryGroups: BudgetCategoryGroups,
    budgetId: string
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
      } = this.spendingService.calculateSpendingTrackings(
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
    const baseMonthlyAmount = Math.ceil((totalAmount / numMonths) * 100) / 100;

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
  allRecurringTransactions: BudgetFinAccountRecurringTransaction[];  // Changed
  newTransactions: BudgetFinAccountTransaction[];
  existingUnlinkedTransactions: FinAccountTransaction[];
  existingUnlinkedRecurringTransactions: FinAccountRecurringTransaction[];
  newUnlinkedTransactions: FinAccountTransaction[];
  newRecurringTransactions: BudgetFinAccountRecurringTransaction[];  // Changed
  newUnlinkedRecurringTransactions: FinAccountRecurringTransaction[];
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
  saveBudgetGoalWithTracking: (goal: BudgetGoal, trackingStartingBalance: number) => Promise<ServiceResult<BudgetGoal>>;
  getPlaidConnectionItemSummaries: (budgetId: string) => Promise<ServiceResult<PlaidConnectionItemSummary[]>>;
  getManualInstitutionIds: (budgetId: string) => Promise<ServiceResult<string[]>>;
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
  parseBudgetTags: (tags: Database['public']['Functions']['get_budget_tags_by_team_account_slug']['Returns']) => BudgetFinAccountTransactionTag[];
  onboardingAnalysis: (
    budgetId: string,
    plaidConnectionItems: PlaidConnectionItemSummary[],
    plaidConfiguration: Configuration,
    manualInstitutionIds: string[]
  ) => Promise<ServiceResult<OnboardingRecommendSpendingAndGoalsResult>>;
  onboardingRecommendSpendingAndGoals: (
    transactions: BudgetFinAccountTransaction[],
    goals: BudgetGoal[],
    categoryGroups: BudgetCategoryGroups,
    budgetId: string
  ) => Promise<OnboardingRecommendSpendingAndGoalsResult>;
  updateSpending: (
    budgetId: string,
    recommendations: BudgetSpendingRecommendations,
    tracking: BudgetSpendingTrackingsByMonth
  ) => Promise<ServiceResult<null>>;
  updateGoalSpending: (
    budgetId: string,
    recommendations: BudgetGoalMultiRecommendations,
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
  goalSpendingRecommendations: BudgetGoalMultiRecommendations | null;
  // The key is the goal id
  goalSpendingTrackings: Record<string, BudgetGoalSpendingTrackingsByMonth> | null;
  error: string | null;
};
