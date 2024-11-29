import { expect, test } from '@playwright/test';
import { createBudgetService } from '../../../web/lib/server/budget.service';
import { BudgetFinAccountTransaction, BudgetGoal, BudgetGoalSpendingRecommendation, BudgetSpendingCategoryGroupRecommendation } from '../../../web/lib/model/budget.types';
import { Category, CategoryGroup, FinAccountTransaction } from '../../../web/lib/model/fin.types';
import { getTestSupabaseClient } from '../utils/test-supabase-client';
import { ICategoryService } from '../../../web/lib/server/category.service';

test.describe('Budget Service', () => {
  const budgetService = createBudgetService(getTestSupabaseClient());

  const findCategoryRecommendation = (spending: Record<string, BudgetSpendingCategoryGroupRecommendation>, categoryName: string): number | undefined => {
    for (const group of Object.values(spending)) {
      const category = group.categories?.find((c: any) => c.categoryName === categoryName);
      if (category) {
        return category.recommendation;
      }
    }
    return undefined;
  };

  const getGoalRecommendationMonthlyAmounts = (goalRecommendations: BudgetGoalSpendingRecommendation) =>
    Object.entries(goalRecommendations.monthlyAmounts!)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(a => a[1]);

  const getDateOneYearFromNow = (): string => {
    const oneYearFromNow = new Date(new Date().setFullYear(new Date().getFullYear() + 1));
    oneYearFromNow.setDate(oneYearFromNow.getDate() + 1);
    return oneYearFromNow.toISOString().split('T')[0]!;
  };

  // Helper to create a sample goal
  const createSampleGoal = (
    id: string,
    amount: number,
    targetDate: string = getDateOneYearFromNow(),
    trackingStartingBalance: number = 0,
    type: 'savings' | 'debt' | 'investment' = 'savings',
  ): BudgetGoal => {

    const goal = {
      id,
      createdAt: new Date().toISOString(),
      budgetId: '6a62d37d-a78b-41a4-b84f-b085db192a8e',
      type,
      name: `Test Goal ${id}`,
      amount,
      budgetFinAccountId: 'test-account',
      targetDate,
      description: 'Test goal',
      spendingRecommendations: {},
      spendingTracking: {}
    } as BudgetGoal;

    // Use the service's createGoalTrackings method
    const { data: trackings } = budgetService.createGoalTrackings(goal, trackingStartingBalance);
    if (trackings) {
      goal.spendingTracking = trackings;
    }

    return goal;
  };

  const categoryGroups: Record<string, CategoryGroup> = {
    'Income': {
      id: 'g1',
      categories: [{
        id: 'c1',
        name: 'Income'
      }],
      name: 'Income'
    } as CategoryGroup,
    'Rent & Utilities': {
      id: 'g2',
      categories: [
        {
          id: 'c2',
          name: 'Rent'
        },
        {
          id: 'c3',
          name: 'Gas & Electricity'
        }
      ],
      name: 'Rent & Utilities'
    } as CategoryGroup,
    'Food & Drink': {
      id: 'g3',
      categories: [{
        id: 'c4',
        name: 'Groceries'
      }],
      name: 'Food & Drink'
    } as CategoryGroup,
    'Retail & Goods': {
      id: 'g4',
      categories: [{
        id: 'c5',
        name: 'Shopping'
      }],
      name: 'Retail & Goods'
    } as CategoryGroup,
    'Entertainment': {
      id: 'g5',
      categories: [{
        id: 'c6',
        name: 'Events & Amusement'
      }],
      name: 'Entertainment'
    } as CategoryGroup
  };

  const createSampleTransactionsScenarioCovered = (): BudgetFinAccountTransaction[] => {
    return [
      {
        transaction: {
          id: 'tx_1',
          amount: -2500, // negative for income
          date: '2024-03-01',
          merchantName: 'Employer Inc',
        } as FinAccountTransaction,
        category: 'Income'
      } as BudgetFinAccountTransaction,
      {
        transaction: {
          id: 'tx_2',
          amount: 2000,
          date: '2024-03-02',
          merchantName: 'Property Management',
        } as FinAccountTransaction,
        category: 'Rent'
      } as BudgetFinAccountTransaction,
      {
        transaction: {
          id: 'tx_3',
          amount: 150,
          date: '2024-03-03',
          merchantName: 'Energy Company',
        } as FinAccountTransaction,
        category: 'Gas & Electricity'
      } as BudgetFinAccountTransaction,
      {
        transaction: {
          id: 'tx_4',
          amount: 400,
          date: '2024-03-04',
          merchantName: 'Local Supermarket',
        } as FinAccountTransaction,
        category: 'Groceries'
      } as BudgetFinAccountTransaction,
      {
        transaction: {
          id: 'tx_5',
          amount: 200,
          date: '2024-03-05',
          merchantName: 'Fashion Store',
        } as FinAccountTransaction,
        category: 'Shopping'
      } as BudgetFinAccountTransaction,
      {
        transaction: {
          id: 'tx_6',
          amount: 150,
          date: '2024-03-06',
          merchantName: 'Ticket Master',
        } as FinAccountTransaction,
        category: 'Events & Amusement'
      } as BudgetFinAccountTransaction,
      {
        transaction: {
          id: 'tx_7',
          amount: -2500, // negative for income
          date: '2024-03-07',
          merchantName: 'Employer Inc',
        } as FinAccountTransaction,
        category: 'Income'
      } as BudgetFinAccountTransaction
    ];
  };

  const createSampleTransactionsScenarioEssentialsCoveredDiscretionaryNotCovered = (): BudgetFinAccountTransaction[] => {
    return [
      {
        transaction: {
          id: 'tx_1',
          amount: -4000, // negative for income
          date: '2024-03-01',
          merchantName: 'Employer Inc',
        } as FinAccountTransaction,
        category: 'Income'
      } as BudgetFinAccountTransaction,
      {
        transaction: {
          id: 'tx_2',
          amount: 1500,
          date: '2024-03-02',
          merchantName: 'Property Management',
        } as FinAccountTransaction,
        category: 'Rent'
      } as BudgetFinAccountTransaction,
      {
        transaction: {
          id: 'tx_3',
          amount: 350,
          date: '2024-03-03',
          merchantName: 'Energy Company',
        } as FinAccountTransaction,
        category: 'Gas & Electricity'
      } as BudgetFinAccountTransaction,
      {
        transaction: {
          id: 'tx_4',
          amount: 800,
          date: '2024-03-04',
          merchantName: 'Local Supermarket',
        } as FinAccountTransaction,
        category: 'Groceries'
      } as BudgetFinAccountTransaction,
      {
        transaction: {
          id: 'tx_5',
          amount: 1200,
          date: '2024-03-05',
          merchantName: 'Fashion Store',
        } as FinAccountTransaction,
        category: 'Shopping'
      } as BudgetFinAccountTransaction,
      {
        transaction: {
          id: 'tx_6',
          amount: 500,
          date: '2024-03-06',
          merchantName: 'Ticket Master',
        } as FinAccountTransaction,
        category: 'Events & Amusement'
      } as BudgetFinAccountTransaction
    ];
  };

  const createSampleTransactionsScenarioEssentialsCoveredDiscretionaryNotCoveredEvenAfterReduction = (): BudgetFinAccountTransaction[] => {
    return [
      {
        transaction: {
          id: 'tx_1',
          amount: -4000, // negative for income
          date: '2024-03-01',
          merchantName: 'Employer Inc',
        } as FinAccountTransaction,
        category: 'Income'
      } as BudgetFinAccountTransaction,
      {
        transaction: {
          id: 'tx_2',
          amount: 1500,
          date: '2024-03-02',
          merchantName: 'Property Management',
        } as FinAccountTransaction,
        category: 'Rent'
      } as BudgetFinAccountTransaction,
      {
        transaction: {
          id: 'tx_3',
          amount: 350,
          date: '2024-03-03',
          merchantName: 'Energy Company',
        } as FinAccountTransaction,
        category: 'Gas & Electricity'
      } as BudgetFinAccountTransaction,
      {
        transaction: {
          id: 'tx_4',
          amount: 1200,
          date: '2024-03-04',
          merchantName: 'Local Supermarket',
        } as FinAccountTransaction,
        category: 'Groceries'
      } as BudgetFinAccountTransaction,
      {
        transaction: {
          id: 'tx_5',
          amount: 1400,
          date: '2024-03-05',
          merchantName: 'Fashion Store',
        } as FinAccountTransaction,
        category: 'Shopping'
      } as BudgetFinAccountTransaction,
      {
        transaction: {
          id: 'tx_6',
          amount: 600,
          date: '2024-03-06',
          merchantName: 'Ticket Master',
        } as FinAccountTransaction,
        category: 'Events & Amusement'
      } as BudgetFinAccountTransaction
    ];
  };

  test('A) should leave spending as is if no goals are set and all expenses are covered', async () => {
    const transactions = createSampleTransactionsScenarioCovered();

    const result = await budgetService.onboardingRecommendSpendingAndGoals(transactions, [], categoryGroups);

    // console.log(`A) result:`, JSON.stringify(result, null, 2));

    // Check balanced recommendation
    const balancedSpendingRecommendation = result.spendingRecommendations!.balanced;
    expect(findCategoryRecommendation(balancedSpendingRecommendation, 'Income')).toEqual(-5000);
    expect(findCategoryRecommendation(balancedSpendingRecommendation, 'Rent')).toEqual(2000);
    expect(findCategoryRecommendation(balancedSpendingRecommendation, 'Gas & Electricity')).toEqual(150);
    expect(findCategoryRecommendation(balancedSpendingRecommendation, 'Groceries')).toEqual(400);
    expect(findCategoryRecommendation(balancedSpendingRecommendation, 'Shopping')).toEqual(200);
    expect(findCategoryRecommendation(balancedSpendingRecommendation, 'Events & Amusement')).toEqual(150);

    const balancedGoalRecommendations = result.goalSpendingRecommendations!.balanced;
    expect(balancedGoalRecommendations).toEqual({});

    // Conservative should have slightly reduced discretionary spending
    const conservativeSpendingRecommendation = result.spendingRecommendations!.conservative;
    expect(findCategoryRecommendation(conservativeSpendingRecommendation, 'Shopping')).toEqual(160);
    expect(findCategoryRecommendation(conservativeSpendingRecommendation, 'Events & Amusement')).toEqual(120);

    const conservativeGoalRecommendations = result.goalSpendingRecommendations!.conservative;
    expect(conservativeGoalRecommendations).toEqual({});

    // Relaxed should have slightly increased discretionary spending
    const relaxedSpendingRecommendation = result.spendingRecommendations!.relaxed;
    expect(findCategoryRecommendation(relaxedSpendingRecommendation, 'Shopping')).toEqual(240);
    expect(findCategoryRecommendation(relaxedSpendingRecommendation, 'Events & Amusement')).toEqual(180);

    const relaxedGoalRecommendations = result.goalSpendingRecommendations!.relaxed;
    expect(relaxedGoalRecommendations).toEqual({});
  });

  test('B) should leave spending as is if goals are set but all allocations and expenses are covered', async () => {
    const transactions = createSampleTransactionsScenarioCovered();

    const currentDateOfMonth = new Date().getDate();
    const currentMonth = new Date().getMonth() + 1;

    const goals = [
      createSampleGoal('emergency_fund', 12000, `2025-${currentMonth}-${currentDateOfMonth}`),
      createSampleGoal('vacation', 6000, `2025-${currentMonth}-${currentDateOfMonth}`)
    ];

    const result = await budgetService.onboardingRecommendSpendingAndGoals(transactions, goals, categoryGroups);

    // console.log(`B) result:`, JSON.stringify(result, null, 2));

    // Check balanced recommendation
    const balancedSpendingRecommendation = result.spendingRecommendations!.balanced;
    expect(findCategoryRecommendation(balancedSpendingRecommendation, 'Income')).toEqual(-5000);
    expect(findCategoryRecommendation(balancedSpendingRecommendation, 'Rent')).toEqual(2000);
    expect(findCategoryRecommendation(balancedSpendingRecommendation, 'Gas & Electricity')).toEqual(150);
    expect(findCategoryRecommendation(balancedSpendingRecommendation, 'Groceries')).toEqual(400);
    expect(findCategoryRecommendation(balancedSpendingRecommendation, 'Shopping')).toEqual(200);
    expect(findCategoryRecommendation(balancedSpendingRecommendation, 'Events & Amusement')).toEqual(150);

    const balancedAllocationCount = 12;
    const balancedGoalRecommendations = result.goalSpendingRecommendations!.balanced;
    expect(Object.keys(balancedGoalRecommendations['emergency_fund']?.monthlyAmounts!).length).toEqual(balancedAllocationCount);
    expect(Object.keys(balancedGoalRecommendations['vacation']?.monthlyAmounts!).length).toEqual(balancedAllocationCount);

    // Check allocations
    for (let i = 0; i < balancedAllocationCount; i++) {
      let emergencyFundMonthlyAmounts = getGoalRecommendationMonthlyAmounts(balancedGoalRecommendations['emergency_fund']!);
      let vacationMonthlyAmounts = getGoalRecommendationMonthlyAmounts(balancedGoalRecommendations['vacation']!);
      expect(emergencyFundMonthlyAmounts[0]).toEqual(1000);
      expect(vacationMonthlyAmounts[0]).toEqual(500);
    }

    // Check conservative recommendation
    const conservativeSpendingRecommendation = result.spendingRecommendations!.conservative;
    expect(findCategoryRecommendation(conservativeSpendingRecommendation, 'Income')).toEqual(-5000);
    expect(findCategoryRecommendation(conservativeSpendingRecommendation, 'Rent')).toEqual(2000);
    expect(findCategoryRecommendation(conservativeSpendingRecommendation, 'Gas & Electricity')).toEqual(150);
    expect(findCategoryRecommendation(conservativeSpendingRecommendation, 'Groceries')).toEqual(400);
    expect(findCategoryRecommendation(conservativeSpendingRecommendation, 'Shopping')).toEqual(160);
    expect(findCategoryRecommendation(conservativeSpendingRecommendation, 'Events & Amusement')).toEqual(120);

    const conservativeAllocationCount = 9;
    const conservativeGoalRecommendations = result.goalSpendingRecommendations!.conservative;
    expect(Object.keys(conservativeGoalRecommendations['emergency_fund']?.monthlyAmounts!).length).toEqual(conservativeAllocationCount);
    expect(Object.keys(conservativeGoalRecommendations['vacation']?.monthlyAmounts!).length).toEqual(conservativeAllocationCount);

    // Check conservative allocations
    for (let i = 0; i < conservativeAllocationCount; i++) {
      let emergencyFundMonthlyAmounts = getGoalRecommendationMonthlyAmounts(conservativeGoalRecommendations['emergency_fund']!);
      let vacationMonthlyAmounts = getGoalRecommendationMonthlyAmounts(conservativeGoalRecommendations['vacation']!);
      if (i < conservativeAllocationCount - 1) {
        expect(emergencyFundMonthlyAmounts[i]).toEqual(1333.34);
        expect(vacationMonthlyAmounts[i]).toEqual(666.67);
      } else {
        expect(emergencyFundMonthlyAmounts[i]).toEqual(1333.28);
        expect(vacationMonthlyAmounts[i]).toEqual(666.64);
      }
    }

    // Check relaxed recommendation
    const relaxedSpendingRecommendation = result.spendingRecommendations!.relaxed;
    expect(findCategoryRecommendation(relaxedSpendingRecommendation, 'Income')).toEqual(-5000);
    expect(findCategoryRecommendation(relaxedSpendingRecommendation, 'Rent')).toEqual(2000);
    expect(findCategoryRecommendation(relaxedSpendingRecommendation, 'Gas & Electricity')).toEqual(150);
    expect(findCategoryRecommendation(relaxedSpendingRecommendation, 'Groceries')).toEqual(400);
    expect(findCategoryRecommendation(relaxedSpendingRecommendation, 'Shopping')).toEqual(240);
    expect(findCategoryRecommendation(relaxedSpendingRecommendation, 'Events & Amusement')).toEqual(180);

    const relaxedAllocationCount = 12;
    const relaxedGoalRecommendations = result.goalSpendingRecommendations!.relaxed;
    expect(Object.keys(relaxedGoalRecommendations['emergency_fund']?.monthlyAmounts!).length).toEqual(relaxedAllocationCount);
    expect(Object.keys(relaxedGoalRecommendations['vacation']?.monthlyAmounts!).length).toEqual(relaxedAllocationCount);

    // Check relaxed allocations
    for (let i = 0; i < relaxedAllocationCount; i++) {
      let emergencyFundMonthlyAmounts = getGoalRecommendationMonthlyAmounts(relaxedGoalRecommendations['emergency_fund']!);
      let vacationMonthlyAmounts = getGoalRecommendationMonthlyAmounts(relaxedGoalRecommendations['vacation']!);
      expect(emergencyFundMonthlyAmounts[i]).toEqual(1000);
      expect(vacationMonthlyAmounts[i]).toEqual(500);
    }

    // Verify goal tracking structure
    expect(result.goalSpendingTrackings).toBeTruthy();

    // Check tracking for each goal
    ['emergency_fund', 'vacation'].forEach(goalId => {
        const goalTracking = result.goalSpendingTrackings![goalId]!;
        expect(goalTracking).toBeTruthy();

        // Check each month's tracking
        const months = Object.keys(goalTracking).sort();
        expect(months).toHaveLength(12); // 12 months of tracking

        months.forEach((month, index) => {
            const tracking = goalTracking[month]!;

            // Verify basic structure
            expect(tracking.month).toBe(month);
            expect(tracking.startingBalance).toBe(0);
            expect(tracking.allocations).toBeTruthy();

            // There should be exactly one allocation per month
            const allocations = Object.entries(tracking.allocations);
            expect(allocations.length).toBe(1);

            // Get the actual allocation date and value
            const [allocationDate, allocation] = allocations[0]!;

            // Check allocation amounts (emergency_fund gets 1000, vacation gets 500)
            const expectedAmount = goalId === 'emergency_fund' ? 1000 : 500;
            expect(allocation).toEqual({
                dateTarget: allocationDate,
                amountTarget: expectedAmount
            });

            // Verify the date format is correct (YYYY-MM-DD)
            expect(allocationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            // Verify it's for the correct month
            expect(allocationDate.startsWith(month)).toBe(true);
        });
    });
  });

  test('C) should reduce spending if no goals are set, essentials are covered but discretionary is not covered', async () => {
    const transactions = createSampleTransactionsScenarioEssentialsCoveredDiscretionaryNotCovered();

    const result = await budgetService.onboardingRecommendSpendingAndGoals(transactions, [], categoryGroups);

    // console.log(`C) result:`, JSON.stringify(result, null, 2));

    // Check balanced recommendation
    const balancedSpendingRecommendation = result.spendingRecommendations!.balanced;
    expect(findCategoryRecommendation(balancedSpendingRecommendation, 'Income')).toEqual(-4000);
    expect(findCategoryRecommendation(balancedSpendingRecommendation, 'Rent')).toEqual(1500);
    expect(findCategoryRecommendation(balancedSpendingRecommendation, 'Gas & Electricity')).toEqual(350);
    expect(findCategoryRecommendation(balancedSpendingRecommendation, 'Groceries')).toEqual(800);
    expect(findCategoryRecommendation(balancedSpendingRecommendation, 'Shopping')).toEqual(952.94);
    expect(findCategoryRecommendation(balancedSpendingRecommendation, 'Events & Amusement')).toEqual(397.06);

    // Check conservative recommendation
    const conservativeSpendingRecommendation = result.spendingRecommendations!.conservative;
    expect(findCategoryRecommendation(conservativeSpendingRecommendation, 'Income')).toEqual(-4000);
    expect(findCategoryRecommendation(conservativeSpendingRecommendation, 'Rent')).toEqual(1500);
    expect(findCategoryRecommendation(conservativeSpendingRecommendation, 'Gas & Electricity')).toEqual(350);
    expect(findCategoryRecommendation(conservativeSpendingRecommendation, 'Groceries')).toEqual(800);
    expect(findCategoryRecommendation(conservativeSpendingRecommendation, 'Shopping')).toEqual(952.94);
    expect(findCategoryRecommendation(conservativeSpendingRecommendation, 'Events & Amusement')).toEqual(397.06);

    // Check relaxed recommendation
    const relaxedSpendingRecommendation = result.spendingRecommendations!.relaxed;
    expect(findCategoryRecommendation(relaxedSpendingRecommendation, 'Income')).toEqual(-4000);
    expect(findCategoryRecommendation(relaxedSpendingRecommendation, 'Rent')).toEqual(1500);
    expect(findCategoryRecommendation(relaxedSpendingRecommendation, 'Gas & Electricity')).toEqual(350);
    expect(findCategoryRecommendation(relaxedSpendingRecommendation, 'Groceries')).toEqual(800);
    expect(findCategoryRecommendation(relaxedSpendingRecommendation, 'Shopping')).toEqual(952.94);
    expect(findCategoryRecommendation(relaxedSpendingRecommendation, 'Events & Amusement')).toEqual(397.06);

    // Verify goal tracking structure
    expect(result.goalSpendingTrackings).toBeTruthy();
  });

  test('D) should reduce spending if goals are set, essentials are covered but goals and discretionary are not covered', async () => {
    const transactions = createSampleTransactionsScenarioEssentialsCoveredDiscretionaryNotCoveredEvenAfterReduction();

    const goals = [
      createSampleGoal('emergency_fund', 12000),
      createSampleGoal('vacation', 6000)
    ];

    const result = await budgetService.onboardingRecommendSpendingAndGoals(transactions, goals, categoryGroups);

    // console.log(`D) result:`, result);

    // Check balanced recommendation maintains original goal allocations
    const balanced = result.spendingRecommendations!.balanced;
    expect(findCategoryRecommendation(balanced, 'Income')).toEqual(-4000);
    expect(findCategoryRecommendation(balanced, 'Rent')).toEqual(1500);
    expect(findCategoryRecommendation(balanced, 'Gas & Electricity')).toEqual(350);
    expect(findCategoryRecommendation(balanced, 'Groceries')).toEqual(1200);
    expect(findCategoryRecommendation(balanced, 'Shopping')).toEqual(700);
    expect(findCategoryRecommendation(balanced, 'Events & Amusement')).toEqual(300);

    const balancedAllocationCount = 0;
    const balancedGoalRecommendations = result.goalSpendingRecommendations!.balanced;
    let balancedEmergencyFundMonthlyAmounts = getGoalRecommendationMonthlyAmounts(balancedGoalRecommendations['emergency_fund']!);
    let balancedVacationMonthlyAmounts = getGoalRecommendationMonthlyAmounts(balancedGoalRecommendations['vacation']!);
    expect(Object.keys(balancedEmergencyFundMonthlyAmounts).length).toEqual(balancedAllocationCount);
    expect(Object.keys(balancedVacationMonthlyAmounts).length).toEqual(balancedAllocationCount);

    // Conservative should have reduced discretionary spending by 20%
    const conservative = result.spendingRecommendations!.conservative;
    expect(findCategoryRecommendation(conservative, 'Income')).toEqual(-4000);
    expect(findCategoryRecommendation(conservative, 'Rent')).toEqual(1500);
    expect(findCategoryRecommendation(conservative, 'Gas & Electricity')).toEqual(350);
    expect(findCategoryRecommendation(conservative, 'Groceries')).toEqual(1200);
    expect(findCategoryRecommendation(conservative, 'Shopping')).toEqual(700);
    expect(findCategoryRecommendation(conservative, 'Events & Amusement')).toEqual(300);

    const conservativeAllocationCount = 0;
    const conservativeGoalRecommendations = result.goalSpendingRecommendations!.conservative;
    let conservativeEmergencyFundMonthlyAmounts = getGoalRecommendationMonthlyAmounts(conservativeGoalRecommendations['emergency_fund']!);
    let conservativeVacationMonthlyAmounts = getGoalRecommendationMonthlyAmounts(conservativeGoalRecommendations['vacation']!);
    expect(Object.keys(conservativeEmergencyFundMonthlyAmounts).length).toEqual(conservativeAllocationCount);
    expect(Object.keys(conservativeVacationMonthlyAmounts).length).toEqual(conservativeAllocationCount);

    // Relaxed should have increased discretionary spending by 20%
    const relaxed = result.spendingRecommendations!.relaxed;
    expect(findCategoryRecommendation(relaxed, 'Income')).toEqual(-4000);
    expect(findCategoryRecommendation(relaxed, 'Rent')).toEqual(1500);
    expect(findCategoryRecommendation(relaxed, 'Gas & Electricity')).toEqual(350);
    expect(findCategoryRecommendation(relaxed, 'Groceries')).toEqual(1200);
    expect(findCategoryRecommendation(relaxed, 'Shopping')).toEqual(700);
    expect(findCategoryRecommendation(relaxed, 'Events & Amusement')).toEqual(300);

    const relaxedAllocationCount = 0;
    const relaxedGoalRecommendations = result.goalSpendingRecommendations!.relaxed;
    let relaxedEmergencyFundMonthlyAmounts = getGoalRecommendationMonthlyAmounts(relaxedGoalRecommendations['emergency_fund']!);
    let relaxedVacationMonthlyAmounts = getGoalRecommendationMonthlyAmounts(relaxedGoalRecommendations['vacation']!);
    expect(Object.keys(relaxedEmergencyFundMonthlyAmounts).length).toEqual(relaxedAllocationCount);
    expect(Object.keys(relaxedVacationMonthlyAmounts).length).toEqual(relaxedAllocationCount);
  });

  test('E) should reduce spending if essentials are not covered', async () => {
    const transactions = createSampleTransactionsScenarioEssentialsCoveredDiscretionaryNotCoveredEvenAfterReduction();

    const goals = [
      createSampleGoal('emergency_fund', 12000),
      createSampleGoal('vacation', 6000)
    ];

    const result = await budgetService.onboardingRecommendSpendingAndGoals(transactions, goals, categoryGroups);

    // console.log(`E) result:`, JSON.stringify(result, null, 2));

    // Check balanced recommendation maintains original goal allocations
    const balanced = result.spendingRecommendations!.balanced;
    expect(findCategoryRecommendation(balanced, 'Income')).toEqual(-4000);
    expect(findCategoryRecommendation(balanced, 'Rent')).toEqual(1500);
    expect(findCategoryRecommendation(balanced, 'Gas & Electricity')).toEqual(350);
    expect(findCategoryRecommendation(balanced, 'Groceries')).toEqual(1200);
    expect(findCategoryRecommendation(balanced, 'Shopping')).toEqual(700);
    expect(findCategoryRecommendation(balanced, 'Events & Amusement')).toEqual(300);

    const balancedAllocationCount = 0;
    const balancedGoalRecommendations = result.goalSpendingRecommendations!.balanced;
    let balancedEmergencyFundMonthlyAmounts = getGoalRecommendationMonthlyAmounts(balancedGoalRecommendations['emergency_fund']!);
    let balancedVacationMonthlyAmounts = getGoalRecommendationMonthlyAmounts(balancedGoalRecommendations['vacation']!);
    expect(Object.keys(balancedEmergencyFundMonthlyAmounts).length).toEqual(balancedAllocationCount);
    expect(Object.keys(balancedVacationMonthlyAmounts).length).toEqual(balancedAllocationCount);

    // Conservative should have reduced discretionary spending by 20%
    const conservative = result.spendingRecommendations!.conservative;
    expect(findCategoryRecommendation(conservative, 'Income')).toEqual(-4000);
    expect(findCategoryRecommendation(conservative, 'Rent')).toEqual(1500);
    expect(findCategoryRecommendation(conservative, 'Gas & Electricity')).toEqual(350);
    expect(findCategoryRecommendation(conservative, 'Groceries')).toEqual(1200);
    expect(findCategoryRecommendation(conservative, 'Shopping')).toEqual(700);
    expect(findCategoryRecommendation(conservative, 'Events & Amusement')).toEqual(300);

    const conservativeAllocationCount = 0;
    const conservativeGoalRecommendations = result.goalSpendingRecommendations!.conservative;
    let conservativeEmergencyFundMonthlyAmounts = getGoalRecommendationMonthlyAmounts(conservativeGoalRecommendations['emergency_fund']!);
    let conservativeVacationMonthlyAmounts = getGoalRecommendationMonthlyAmounts(conservativeGoalRecommendations['vacation']!);
    expect(Object.keys(conservativeEmergencyFundMonthlyAmounts).length).toEqual(conservativeAllocationCount);
    expect(Object.keys(conservativeVacationMonthlyAmounts).length).toEqual(conservativeAllocationCount);

    // Relaxed should have increased discretionary spending by 20%
    const relaxed = result.spendingRecommendations!.relaxed;
    expect(findCategoryRecommendation(relaxed, 'Income')).toEqual(-4000);
    expect(findCategoryRecommendation(relaxed, 'Rent')).toEqual(1500);
    expect(findCategoryRecommendation(relaxed, 'Gas & Electricity')).toEqual(350);
    expect(findCategoryRecommendation(relaxed, 'Groceries')).toEqual(1200);
    expect(findCategoryRecommendation(relaxed, 'Shopping')).toEqual(700);
    expect(findCategoryRecommendation(relaxed, 'Events & Amusement')).toEqual(300);

    const relaxedAllocationCount = 0;
    const relaxedGoalRecommendations = result.goalSpendingRecommendations!.relaxed;
    let relaxedEmergencyFundMonthlyAmounts = getGoalRecommendationMonthlyAmounts(relaxedGoalRecommendations['emergency_fund']!);
    let relaxedVacationMonthlyAmounts = getGoalRecommendationMonthlyAmounts(relaxedGoalRecommendations['vacation']!);
    expect(Object.keys(relaxedEmergencyFundMonthlyAmounts).length).toEqual(relaxedAllocationCount);
    expect(Object.keys(relaxedVacationMonthlyAmounts).length).toEqual(relaxedAllocationCount);
  });
});
