import { FinAccountTransaction } from '../model/fin.types';
import { Database } from '~/lib/database.types';
import { BudgetCategoryGroupSpending, BudgetCategorySpending, BudgetGoal, BudgetGoalTracking, BudgetGoalTrackingAllocation } from '../model/budget.types';
import { createCategoryService } from './category.service';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { SupabaseClient } from '@supabase/supabase-js';

export type BudgetRecommendation = {
  spending: Record<string, BudgetCategoryGroupSpending>;
  goalTrackings: Record<string, BudgetGoalTracking>;
};

/**
 * @name BudgetService
 * @description Service for budget-related operations
 */
class BudgetService {
  private categoryService;
  
  constructor(supabaseClient: SupabaseClient) {
    this.categoryService = createCategoryService(supabaseClient);
  }

  /**
   * Recommends spending and goals based on income and goals
   * @param transactions - All transactions for the period
   * @param monthlyCategorySpending - Current spending by category
   * @param goals - Goal tracking data
   * @returns Enhanced category spending data with recommendations
   */
  async recommendSpendingAndGoals(
    transactions: FinAccountTransaction[],
    monthlyCategorySpending: Record<string, number>,
    goals: BudgetGoal[],
    budgetId: string
  ): Promise<Record<string, BudgetRecommendation>> {
    // Get category groups and create mapping at the start
    const categoryGroups = await this.categoryService.getBudgetCategoryGroups(budgetId);
    const categoryToGroupMap = Object.values(categoryGroups).reduce((acc, group) => {
      group.categories.forEach(category => {
        acc[category.name] = group.name;
      });
      return acc;
    }, {} as Record<string, string>);

    const calculateGoalProgress = (tracking: BudgetGoalTracking): number => {
      return tracking.allocations.reduce((sum, allocation) => sum + allocation.actualAmount, 0);
    };

    const createGoalAllocations = (
      goal: BudgetGoal,
      originalMonthlyAmount: number,
      adjustmentRatio: number
    ) => {
      const today = new Date();
      const goalProgress = calculateGoalProgress(goal.tracking);
      const remainingAmount = goal.amount - goalProgress;
      const adjustedMonthlyAmount = Math.round(originalMonthlyAmount * adjustmentRatio * 100) / 100;

      // Validate adjustedMonthlyAmount
      if (adjustedMonthlyAmount <= 0) {
        console.warn('budgetService >> recommendSpendingAndGoals >> adjusted monthly goal allocation is zero or negative:', adjustedMonthlyAmount);
        return []; // Return an empty array or handle as needed
      }

      if (goal.type === 'debt' && goal.debtPaymentComponent === 'principal_interest') {
        // For debt, keep original number of payments
        const numberOfPayments = goal.tracking.allocations.length;
        return createMonthlyAllocations(numberOfPayments, adjustedMonthlyAmount, remainingAmount, today);
      } else {
        // For savings goals, calculate new number of payments based on adjusted amount
        const numberOfPayments = Math.ceil(remainingAmount / adjustedMonthlyAmount);
        
        // Validate numberOfPayments
        if (numberOfPayments <= 0) {
          console.error('Calculated number of payments is zero or negative:', numberOfPayments);
          return []; // Return an empty array or handle as needed
        }

        return createMonthlyAllocations(numberOfPayments, adjustedMonthlyAmount, remainingAmount, today);
      }
    };

    // Helper function to create allocation array
    const createMonthlyAllocations = (
      numberOfPayments: number,
      monthlyAmount: number,
      totalAmount: number,
      startDate: Date
    ): BudgetGoalTrackingAllocation[] => {
      // Validate input parameters
      if (numberOfPayments <= 0) {
        console.error('Invalid number of payments:', numberOfPayments);
        return [];
      }
      if (monthlyAmount < 0 || totalAmount < 0) {
        console.error('Invalid amounts:', { monthlyAmount, totalAmount });
        return [];
      }

      const allocations: BudgetGoalTrackingAllocation[] = [];
      
      try {
        // Ensure startDate is valid
        if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
          console.error('Invalid start date received:', startDate);
          startDate = new Date(); // Fallback to current date if invalid
        }

        // Create a new date object and normalize it
        const baseDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

        // Validate baseDate
        if (isNaN(baseDate.getTime())) {
          console.error('Invalid base date created:', baseDate);
          return []; // Exit if baseDate is invalid
        }

        for (let i = 0; i < numberOfPayments; i++) {
          // Create a new date for this allocation using setMonth
          const allocationDate = new Date(baseDate);
          allocationDate.setMonth(baseDate.getMonth() + i); // This handles month overflow

          // Validate allocationDate
          if (isNaN(allocationDate.getTime())) {
            console.error('Invalid allocation date created:', allocationDate);
            continue; // Skip this iteration if the date is invalid
          }

          // For the last allocation, adjust to make up any rounding difference
          const isLastAllocation = i === numberOfPayments - 1;
          const currentAllocatedTotal = monthlyAmount * i;
          const plannedAmount = isLastAllocation
            ? Math.round((totalAmount - currentAllocatedTotal) * 100) / 100
            : monthlyAmount;

          allocations.push({
            date: allocationDate.toISOString().split('T')[0]!,
            plannedAmount,
            actualAmount: 0
          });
        }
      } catch (error) {
        console.error('Error in createMonthlyAllocations:', error);
        // Return at least one allocation as fallback
        return [{
          date: new Date().toISOString().split('T')[0]!,
          plannedAmount: monthlyAmount,
          actualAmount: 0
        }];
      }

      return allocations;
    };

    // Convert goals to initial tracking state
    const goalTrackings = goals.reduce((acc, goal) => {
      acc[goal.id] = { ...goal.tracking };
      return acc;
    }, {} as Record<string, BudgetGoalTracking>);

    const latestTransactionDate = transactions.length > 0
      ? new Date(transactions[transactions.length - 1]!.date)
      : new Date();
    const thirtyDaysBeforeLatest = new Date(latestTransactionDate);
    thirtyDaysBeforeLatest.setDate(thirtyDaysBeforeLatest.getDate() - 30);

    // Calculate monthly goal allocations using goalTrackings
    const monthlyGoalAllocations = Object.values(goalTrackings).reduce((total, tracking) => {
      const firstAllocation = tracking.allocations[0];
      if (!firstAllocation) return total;
      return total + firstAllocation.plannedAmount;
    }, 0);

    const totalIncome = Math.abs(monthlyCategorySpending['Income'] || 0);
    const discretionaryCategories = [
      'Shopping', 'Online Marketplaces', 'Superstores',
      'Other Entertainment', 'Events & Amusement', 'Video Games',
      'TV & Movies', 'Music & Audio'
    ];

    // Calculate spending totals
    const totalDiscretionarySpending = Object.entries(monthlyCategorySpending)
      .filter(([cat]) => discretionaryCategories.includes(cat))
      .reduce((sum, [, amount]) => sum + amount, 0);

    const totalNonDiscretionarySpending = Object.entries(monthlyCategorySpending)
      .filter(([cat]) => !discretionaryCategories.includes(cat) && cat !== 'Income')
      .reduce((sum, [, amount]) => sum + amount, 0);

    // Check if essentials are covered
    const essentialsCovered = totalIncome >= totalNonDiscretionarySpending;

    // Initialize recommendation sets
    const recommendations: Record<string, BudgetRecommendation> = {
      balanced: { spending: {}, goalTrackings: {} },
      conservative: { spending: {}, goalTrackings: {} },
      relaxed: { spending: {}, goalTrackings: {} }
    };

    // If essentials aren't covered, zero out goals and reduce all discretionary spending proportionally
    if (!essentialsCovered) {
      const maxReduction = 0.5;
      const requiredReduction = totalNonDiscretionarySpending - totalIncome;
      const reductionRatio = Math.min(maxReduction, requiredReduction / totalDiscretionarySpending);

      // Apply same recommendations for all types since we're in survival mode
      ['balanced', 'conservative', 'relaxed'].forEach(recType => {
        // First initialize the grouped spending structure
        recommendations[recType]!.spending = {};

        // When processing each category
        for (const [category, spending] of Object.entries(monthlyCategorySpending)) {
          const isIncome = category === 'Income';
          const isDiscretionary = discretionaryCategories.includes(category);
          const reduction = isIncome ? 0 : (isDiscretionary ? reductionRatio : 0);

          const groupName = categoryToGroupMap[category] || 'Other';
          if (!recommendations[recType]!.spending[groupName]) {
            recommendations[recType]!.spending[groupName] = {
              groupName: groupName,
              spending: 0,
              recommendation: 0,
              target: 0,
              isTaxDeductible: false,
              targetSource: 'group',
              categories: []
            };
          }

          // Add to group totals
          recommendations[recType]!.spending[groupName]!.spending += Math.round(spending * 100) / 100;
          recommendations[recType]!.spending[groupName]!.recommendation += isIncome ? 
            Math.round(spending * 100) / 100 : 
            Math.round((spending * (1 - reduction)) * 100) / 100;
          recommendations[recType]!.spending[groupName]!.target += isIncome ? 
            Math.round(spending * 100) / 100 : 
            Math.round((spending * (1 - reduction)) * 100) / 100;

          // Add category to group's categories array
          recommendations[recType]!.spending[groupName]!.categories.push({
            categoryName: category,
            spending: Math.round(spending * 100) / 100,
            recommendation: isIncome ? 
              Math.round(spending * 100) / 100 : 
              Math.round((spending * (1 - reduction)) * 100) / 100,
            target: isIncome ? 
              Math.round(spending * 100) / 100 : 
              Math.round((spending * (1 - reduction)) * 100) / 100,
            isTaxDeductible: false
          });
        }

        // Zero out all goal trackings
        for (const goal of goals) {
          recommendations[recType]!.goalTrackings[goal.id] = {
            ...goal.tracking,
            allocations: createGoalAllocations(goal, 0, 1)
          };
        }
      });



      return recommendations;
    }

    // If essentials are covered, calculate discretionary reductions
    const availableAfterEssentials = totalIncome - totalNonDiscretionarySpending;
    const needsReduction = availableAfterEssentials < (totalDiscretionarySpending + monthlyGoalAllocations);

    // Calculate three different reduction strategies
    const reductionStrategies = {
      balanced: needsReduction ?
        Math.min(0.5, ((totalDiscretionarySpending + monthlyGoalAllocations) - availableAfterEssentials) / (totalDiscretionarySpending + monthlyGoalAllocations)) :
        0,

      conservative: 0.2,  // Always reduce discretionary by 20%

      relaxed: needsReduction ?
        Math.min(0.5, ((totalDiscretionarySpending + monthlyGoalAllocations) - availableAfterEssentials) / (totalDiscretionarySpending + monthlyGoalAllocations)) :
        -0.2  // 20% increase in discretionary spending
    };

    // Helper function to calculate available money after spending
    const calculateAvailableAfterSpending = (spendingReduction: number) => {
      const adjustedDiscretionarySpending = totalDiscretionarySpending * (1 - spendingReduction);
      return totalIncome - totalNonDiscretionarySpending - adjustedDiscretionarySpending;
    };

    // Apply recommendations for each strategy
    Object.entries(reductionStrategies).forEach(([strategy, reductionRatio]) => {
      // Initialize spending structure for this strategy
      recommendations[strategy]!.spending = {};

      // Process each category and group it
      for (const [category, spending] of Object.entries(monthlyCategorySpending)) {
        const isIncome = category === 'Income';
        const isDiscretionary = discretionaryCategories.includes(category);
        const reduction = isDiscretionary ? reductionRatio : 0;

        const groupName = categoryToGroupMap[category] || 'Other';
        if (!recommendations[strategy]!.spending[groupName]) {
          recommendations[strategy]!.spending[groupName] = {
            groupName: groupName,
            spending: 0,
            recommendation: 0,
            target: 0,
            isTaxDeductible: false,
            targetSource: 'group',
            categories: []
          };
        }

        // Add to group totals
        recommendations[strategy]!.spending[groupName]!.spending += Math.round(spending * 100) / 100;
        recommendations[strategy]!.spending[groupName]!.recommendation += isIncome ? 
          Math.round(spending * 100) / 100 : 
          Math.round((spending * (1 - reduction)) * 100) / 100;
        recommendations[strategy]!.spending[groupName]!.target += isIncome ? 
          Math.round(spending * 100) / 100 : 
          Math.round((spending * (1 - reduction)) * 100) / 100;

        // Add category to group's categories array
        recommendations[strategy]!.spending[groupName]!.categories.push({
          categoryName: category,
          spending: Math.round(spending * 100) / 100,
          recommendation: isIncome ? 
            Math.round(spending * 100) / 100 : 
            Math.round((spending * (1 - reduction)) * 100) / 100,
          target: isIncome ? 
            Math.round(spending * 100) / 100 : 
            Math.round((spending * (1 - reduction)) * 100) / 100,
          isTaxDeductible: false
        });
      }

      // Then adjust goal trackings based on strategy
      const availableAfterSpending = calculateAvailableAfterSpending(reductionRatio);

      switch (strategy) {
        case 'balanced':
          if (goals.length > 0) {
            if (availableAfterSpending >= monthlyGoalAllocations) {
              recommendations[strategy]!.goalTrackings = { ...goalTrackings };
            } else {
              const reductionRatio = availableAfterSpending / monthlyGoalAllocations;
              for (const goal of goals) {
                const originalTracking = goalTrackings[goal.id];
                const originalAmount = originalTracking?.allocations[0]?.plannedAmount!;
                recommendations[strategy]!.goalTrackings[goal.id] = {
                  ...goal.tracking,
                  allocations: createGoalAllocations(goal, originalAmount, reductionRatio)
                };
              }
            }
          }
          break;

        case 'conservative':
          if (goals.length > 0) {
            // Start with standard 20% reduction
            let currentReduction = 0.2;
            let availableAfterSpending = calculateAvailableAfterSpending(currentReduction);

            // If 20% reduction isn't enough for goals, increase reduction up to 50%
            if (availableAfterSpending < monthlyGoalAllocations) {
              const requiredReduction = ((monthlyGoalAllocations - availableAfterSpending) + totalDiscretionarySpending * 0.2) / totalDiscretionarySpending;
              currentReduction = Math.min(0.5, requiredReduction);
              availableAfterSpending = calculateAvailableAfterSpending(currentReduction);
            }

            // Update spending recommendations with the final reduction
            recommendations[strategy]!.spending = {};
            for (const [category, spending] of Object.entries(monthlyCategorySpending)) {
              const isIncome = category === 'Income';
              const isDiscretionary = discretionaryCategories.includes(category);
              const reduction = isDiscretionary ? currentReduction : 0;

              const groupName = categoryToGroupMap[category] || 'Other';
              if (!recommendations[strategy]!.spending[groupName]) {
                recommendations[strategy]!.spending[groupName] = {
                  groupName: groupName,
                  spending: 0,
                  recommendation: 0,
                  target: 0,
                  isTaxDeductible: false,
                  targetSource: 'group',
                  categories: []
                };
              }

              // Add to group totals
              recommendations[strategy]!.spending[groupName]!.spending += Math.round(spending * 100) / 100;
              recommendations[strategy]!.spending[groupName]!.recommendation += isIncome ? 
                Math.round(spending * 100) / 100 : 
                Math.round((spending * (1 - reduction)) * 100) / 100;
              recommendations[strategy]!.spending[groupName]!.target += isIncome ? 
                Math.round(spending * 100) / 100 : 
                Math.round((spending * (1 - reduction)) * 100) / 100;

              // Add category to group's categories array
              recommendations[strategy]!.spending[groupName]!.categories.push({
                categoryName: category,
                spending: Math.round(spending * 100) / 100,
                recommendation: isIncome ? 
                  Math.round(spending * 100) / 100 : 
                  Math.round((spending * (1 - reduction)) * 100) / 100,
                target: isIncome ? 
                  Math.round(spending * 100) / 100 : 
                  Math.round((spending * (1 - reduction)) * 100) / 100,
                isTaxDeductible: false
              });
            }

            // After spending reduction, check if we can maximize goal allocations
            if (availableAfterSpending >= monthlyGoalAllocations) {
              // If we have extra money, try to maximize goal allocations
              const increaseRatio = Math.min(1.5, 1 + (availableAfterSpending - monthlyGoalAllocations) / monthlyGoalAllocations);
              for (const goal of goals) {
                const originalTracking = goalTrackings[goal.id];
                const originalAmount = originalTracking?.allocations[0]?.plannedAmount!;
                recommendations[strategy]!.goalTrackings[goal.id] = {
                  ...goal.tracking,
                  allocations: createGoalAllocations(goal, originalAmount, increaseRatio)
                };
              }
            } else {
              // If we can't meet original allocations, reduce them
              const reductionRatio = availableAfterSpending / monthlyGoalAllocations;
              for (const goal of goals) {
                const originalTracking = goalTrackings[goal.id];
                const originalAmount = originalTracking?.allocations[0]?.plannedAmount!;
                recommendations[strategy]!.goalTrackings[goal.id] = {
                  ...goal.tracking,
                  allocations: createGoalAllocations(goal, originalAmount, reductionRatio)
                };
              }
            }
          }
          break;

        case 'relaxed':
          if (goals.length > 0) {
            // First calculate available money after increased discretionary spending
            const increasedDiscretionary = totalDiscretionarySpending * 1.2;
            let availableForGoals = totalIncome - totalNonDiscretionarySpending - increasedDiscretionary;

            // If we can't afford goals with increased discretionary, try reducing discretionary up to 50%
            if (availableForGoals < monthlyGoalAllocations) {
              const reducedDiscretionary = totalDiscretionarySpending * 0.5; // Maximum 50% reduction
              availableForGoals = totalIncome - totalNonDiscretionarySpending - reducedDiscretionary;

              // Update spending recommendations with the reduction
              recommendations[strategy]!.spending = {};
              for (const [category, spending] of Object.entries(monthlyCategorySpending)) {
                const isDiscretionary = discretionaryCategories.includes(category);
                const reduction = isDiscretionary ? 0.5 : 0;

                const groupName = categoryToGroupMap[category] || 'Other';
                if (!recommendations[strategy]!.spending[groupName]) {
                  recommendations[strategy]!.spending[groupName] = {
                    groupName: groupName,
                    spending: 0,
                    recommendation: 0,
                    target: 0,
                    isTaxDeductible: false,
                    targetSource: 'group',
                    categories: []
                  };
                }

                // Add to group totals
                recommendations[strategy]!.spending[groupName]!.spending += Math.round(spending * 100) / 100;
                recommendations[strategy]!.spending[groupName]!.recommendation += Math.round(spending * (1 - reduction) * 100) / 100;
                recommendations[strategy]!.spending[groupName]!.target += Math.round(spending * (1 - reduction) * 100) / 100;

                // Add category to group's categories array
                recommendations[strategy]!.spending[groupName]!.categories.push({
                  categoryName: category,
                  spending: Math.round(spending * 100) / 100,
                  recommendation: Math.round(spending * (1 - reduction) * 100) / 100,
                  target: Math.round(spending * (1 - reduction) * 100) / 100,
                  isTaxDeductible: false,
                } as BudgetCategorySpending);
              }
            }

            // Now handle goal allocations based on available money
            if (availableForGoals >= monthlyGoalAllocations) {
              recommendations[strategy]!.goalTrackings = { ...goalTrackings };
            } else {
              const reductionRatio = availableForGoals / monthlyGoalAllocations;
              for (const goal of goals) {
                const originalTracking = goalTrackings[goal.id];
                const originalAmount = originalTracking?.allocations[0]?.plannedAmount!;
                recommendations[strategy]!.goalTrackings[goal.id] = {
                  ...goal.tracking,
                  allocations: createGoalAllocations(goal, originalAmount, reductionRatio)
                };
              }
            }
          }
          break;
      }
    });

    // Final safety check
    ['balanced', 'conservative', 'relaxed'].forEach(strategy => {
      recommendations[strategy]!.goalTrackings = recommendations[strategy]!.goalTrackings || {};
    });

    return recommendations;
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
  parseBudgetGoal(raw: Database['public']['Tables']['budget_goals']['Row']): BudgetGoal | null {
    try {
      // Validate required fields exist
      if (!raw.id || !raw.budget_id || !raw.type || !raw.amount ||
        !raw.target_date || !raw.fin_account_id || !raw.name || !raw.tracking) {
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

      // Calculate number of allocations based on months between now and target date
      const startDate = new Date();
      const monthsDiff = (targetDate.getFullYear() - startDate.getFullYear()) * 12 +
        (targetDate.getMonth() - startDate.getMonth());
      const numAllocations = Math.max(1, monthsDiff);

      // Calculate base monthly amount with 2 decimal precision
      const baseMonthlyAmount = Math.round((raw.amount / numAllocations) * 100) / 100;

      // Create allocations array
      const allocations = Array.from({ length: numAllocations }, (_, i) => {
        const allocationDate = new Date(startDate);
        allocationDate.setMonth(startDate.getMonth() + i);

        // For the last allocation, adjust to make up any rounding difference
        const isLastAllocation = i === numAllocations - 1;
        const currentAllocatedTotal = baseMonthlyAmount * i;
        const plannedAmount = isLastAllocation
          ? Math.round((raw.amount - currentAllocatedTotal) * 100) / 100
          : baseMonthlyAmount;

        return {
          date: allocationDate.toISOString().split('T')[0]!,
          plannedAmount,
          actualAmount: 0
        };
      });

      // return the goal
      return {
        id: raw.id,
        budgetId: raw.budget_id,
        type: raw.type,
        name: raw.name,
        amount: raw.amount,
        targetDate: raw.target_date,
        budgetFinAccountId: raw.fin_account_id,
        debtInterestRate: raw.debt_interest_rate ?? undefined,
        debtPaymentComponent: raw.debt_payment_component ?? undefined,
        debtType: raw.debt_type ?? undefined,
        createdAt: raw.created_at,
        tracking: raw.tracking as any,
        description: raw.description ?? undefined,
      } as BudgetGoal;
    } catch (error) {
      console.error('Error parsing budget goal:', error);
      return null;
    }
  }
}

/**
 * Creates an instance of the BudgetService.
 * @param supabaseClient - The Supabase client instance
 * @returns An instance of BudgetService.
 */
export function createBudgetService(supabaseClient: ReturnType<typeof getSupabaseServerClient>) {
  return new BudgetService(supabaseClient);
}
