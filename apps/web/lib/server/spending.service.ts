import { Database } from '../database.types';
import { createCategoryService } from './category.service';
import { SupabaseClient } from '@supabase/supabase-js';
import { BudgetCategoryGroups, BudgetFinAccountTransaction, BudgetSpendingTrackingsByMonth } from '../model/budget.types';
import { createBudgetTransactionService, IBudgetTransactionService } from './budget.tx.service';

/**
 * @name SpendingService
 * @description Service for spending-related operations
 */
class SpendingService implements ISpendingService {
  private budgetTransactionService: IBudgetTransactionService;

  constructor(
    private readonly supabase: SupabaseClient<Database>
  ) {
    const categoryService = createCategoryService(supabase);
    this.budgetTransactionService = createBudgetTransactionService(supabase, categoryService);
  }

  /**
   * Updates budget spending in the database
   * @param budgetId The ID of the budget to update
   * @param months The months to recalculate (format: YYYY-MM)
   */
  async updateRecalculateSpending(
    budgetId: string,
    months: string[]
  ): Promise<ServiceResult<BudgetSpendingTrackingsByMonth>> {
    try {
      // Validate months
      const currentYear = new Date().getFullYear();
      const validMonthRegex = /^\d{4}-(?:0[1-9]|1[0-2])$/;
      for (const month of months) {
        if (!validMonthRegex.test(month)) {
          return { data: null, error: `Invalid month format: ${month}. Expected format: YYYY-MM` };
        }
        const year = parseInt(month.substring(0, 4));
        if (Math.abs(year - currentYear) > 100) {
          return { data: null, error: `Year ${year} is too far from current year` };
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

      // Get category groups and transactions
      const categoryService = createCategoryService(this.supabase);
      const categoryGroups = await categoryService.getBudgetCategoryGroups(budgetId);

      // Process each month
      for (const month of months) {
        if (!dbTracking[month]) continue;

        // Get transactions for this month
        const { data: dbTransactions, error: txError } = await this.supabase
          .rpc('get_budget_transactions_within_range_by_budget_id', {
            p_budget_id: budgetId,
            p_start_date: `${month}-01`,
            p_end_date: new Date(parseInt(month.substring(0, 4)), parseInt(month.substring(5, 7)), 0).toISOString().split('T')[0]!
          });

        if (txError) {
          return { data: null, error: `Failed to fetch transactions: ${txError.message}` };
        }

        // Calculate new spending tracking
        const parsedTransactions = this.budgetTransactionService.parseBudgetTransactions(dbTransactions);
        const { spendingTrackingsByMonth } = this.calculateSpendingTrackings(parsedTransactions, categoryGroups, dbTracking);

        // Merge tracking data
        Object.entries(spendingTrackingsByMonth[month]!).forEach(([groupName, newGroupTracking]) => {
          if (groupName === budgetId) return;
          if (!dbTracking[month]?.[groupName]) return;

          dbTracking[month]![groupName] = {
            ...dbTracking[month]![groupName]!,
            ...newGroupTracking,
            spendingTarget: dbTracking[month]![groupName]!.spendingTarget,
            targetSource: dbTracking[month]![groupName]!.targetSource,
            isTaxDeductible: dbTracking[month]![groupName]!.isTaxDeductible
          };
        });
      }

      // Update budget with merged tracking
      const { error: updateError } = await this.supabase
        .from('budgets')
        .update({ spending_tracking: dbTracking })
        .eq('id', budgetId);

      if (updateError) {
        return { data: null, error: `Failed to update budget: ${updateError.message}` };
      }

      return { data: dbTracking, error: null };
    } catch (error: any) {
      return { data: null, error: error.message };
    }
  }

  /**
   * 6. Calculates monthly spending records
   * @param budgetTransactions - Array of sorted transactions
   * @param categoryGroups - Record of category groups
   * @param categoryToGroupMap - Mapping of categories to their groups
   * @returns Object containing monthly spending tracking data
   */
  calculateSpendingTrackings(
    budgetTransactions: BudgetFinAccountTransaction[],
    categoryGroups: BudgetCategoryGroups,
    existingTracking?: BudgetSpendingTrackingsByMonth
  ): {
    spendingTrackingsByMonth: BudgetSpendingTrackingsByMonth
  } {
    // Initialize with current month if no transactions
    const earliestTransactionDate = budgetTransactions.length > 0 
        ? new Date(budgetTransactions[budgetTransactions.length - 1]!.transaction.date)
        : new Date();

    // Initialize spending tracking data structure for all months in range
    const spendingTrackingsByMonth: BudgetSpendingTrackingsByMonth = {};
    const currentDate = new Date(earliestTransactionDate);
    currentDate.setDate(1);
    const endDate = new Date();
    endDate.setDate(2);

    // Initialize months
    while (currentDate <= endDate) {
      const monthKey = currentDate.toISOString().substring(0, 7);
      spendingTrackingsByMonth[monthKey] = {};

      // Initialize groups with existing data
      Object.values(categoryGroups).forEach(group => {
        const existingGroup = existingTracking?.[monthKey]?.[group.name];
        spendingTrackingsByMonth[monthKey]![group.name] = {
          groupName: group.name,
          targetSource: existingGroup?.targetSource ?? 'group',
          spendingActual: 0,
          spendingTarget: 0,
          categories: existingGroup?.categories
            .filter(c => c.isTaxDeductible || c.spendingActual !== 0 || c.spendingTarget !== 0)
            .map(c => ({ ...c, spendingActual: 0, spendingTarget: 0 })) ?? [],
          isTaxDeductible: existingGroup?.isTaxDeductible ?? false
        };
      });

      // Add "Other" group
      spendingTrackingsByMonth[monthKey]!['Other'] = {
        groupName: 'Other',
        targetSource: 'group',
        spendingActual: 0,
        spendingTarget: 0,
        categories: [{ categoryName: 'Other', spendingActual: 0, spendingTarget: 0, isTaxDeductible: false }],
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

    // generate categoryToGroupMap - skip groups that match the budget ID
    const categoryToGroupMap = Object.values(categoryGroups).reduce((acc, group) => {
      // Skip the group if its name matches any budget ID
      if (group.budgetId && group.name === group.budgetId) {
        return acc;
      }

      group.categories.forEach(category => {
        acc[category.name] = group.name;
      });
      return acc as Record<string, string>
    }, {} as Record<string, string>);

    // Process each month's transactions
    Object.entries(monthlyTransactions).forEach(([monthKey, transactions]) => {
      transactions.forEach(tx => {
        // Handle composite categories
        if (tx.category?.isComposite && tx.category.compositeData) {
          tx.category.compositeData.forEach(component => {
            const groupName = categoryToGroupMap[component.categoryName] ?? 'Other';
            const group = spendingTrackingsByMonth[monthKey]![groupName]!;
            const componentAmount = tx.transaction.amount * (component.weight / 100);
            const amount = (groupName.toLowerCase() === 'income' ? -Math.abs(componentAmount) : componentAmount);

            let category = group.categories.find(c => c.categoryName === component.categoryName);
            if (!category) {
              category = {
                categoryName: component.categoryName,
                spendingActual: amount,
                spendingTarget: amount,
                isTaxDeductible: false
              };
              group.categories.push(category);
            } else {
              category.spendingActual += amount;
              category.spendingTarget += amount;
            }
          });
        } else {
          // Handle regular categories
          const groupName = tx.category?.name ? categoryToGroupMap[tx.category.name] ?? 'Other' : 'Other';
          const categoryName = tx.category?.name ?? 'Other';
          const group = spendingTrackingsByMonth[monthKey]![groupName]!;
          const amount = groupName.toLowerCase() === 'income' ? -Math.abs(tx.transaction.amount) : tx.transaction.amount;

          if (groupName === 'Other') {
            const otherCategory = group.categories[0]!;
            otherCategory.spendingActual += amount;
            otherCategory.spendingTarget += amount;
          } else {
            let category = group.categories.find(c => c.categoryName === categoryName);
            if (!category) {
              category = {
                categoryName,
                spendingActual: amount,
                spendingTarget: amount,
                isTaxDeductible: false
              };
              group.categories.push(category);
            } else {
              category.spendingActual += amount;
              category.spendingTarget += amount;
            }
          }
        }
      });

      // Recalculate group totals
      Object.values(spendingTrackingsByMonth[monthKey]!).forEach(group => {
        group.spendingActual = group.categories.reduce((sum, cat) => sum + cat.spendingActual, 0);
        group.spendingTarget = group.categories.reduce((sum, cat) => sum + cat.spendingTarget, 0);
      });
    });

    return { spendingTrackingsByMonth };
  }
}

export interface ISpendingService {
  updateRecalculateSpending: (
    budgetId: string,
    months: string[]
  ) => Promise<ServiceResult<BudgetSpendingTrackingsByMonth>>;
  calculateSpendingTrackings: (
    budgetTransactions: BudgetFinAccountTransaction[],
    categoryGroups: BudgetCategoryGroups,
    existingTracking?: BudgetSpendingTrackingsByMonth
  ) => {
    spendingTrackingsByMonth: BudgetSpendingTrackingsByMonth
  };
}

export type ServiceResult<T> = {
  data: T | null;
  error: string | null;
};

/**
 * Creates an instance of the SpendingService.
 */
export function createSpendingService(
  supabaseClient: SupabaseClient
): ISpendingService {
  return new SpendingService(supabaseClient);
}
