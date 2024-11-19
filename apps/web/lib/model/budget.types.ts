import { Database } from '../database.types';
import { FinAccount } from './fin.types';

export type Budget = {
    id: string;
    budgetType: string;
    categoryGroupSpending: Record<string, BudgetCategoryGroupSpending>;
    recommendedCategoryGroupSpending: Record<string, Record<string, BudgetCategoryGroupSpending>>;
    goals: BudgetGoal[];
    onboardingStep: Database['public']['Tables']['budgets']['Row']['current_onboarding_step'];
    linkedFinAccounts: Array<FinAccount>;
}

export type BudgetCategoryGroupSpending = {
    groupName: string;
    groupId?: string;
    spending: number,
    recommendation: number,
    target: number,
    isTaxDeductible: boolean,
    targetSource: 'group' | 'category',
    categories: Array<BudgetCategorySpending>
}

export type BudgetCategorySpending = {
    categoryName: string;
    categoryId?: string;
    spending: number;
    recommendation: number;
    target: number;
    isTaxDeductible: boolean;
}

export interface BudgetGoal {
    id: string;
    createdAt: string;
    budgetId: string;
    type: 'savings' | 'debt' | 'investment';
    name: string;
    amount: number;
    budgetFinAccountId: string;
    targetDate: string;
    tracking: BudgetGoalTracking;
    debtInterestRate?: number;
    debtPaymentComponent?: 'principal' | 'interest' | 'principal_interest';
    debtType?: string;
    description?: string;
}

export type BudgetGoalTracking = {
    startingBalance: number;
    allocations: Array<BudgetGoalTrackingAllocation>;
}

export type BudgetGoalTrackingAllocation = {
    date: string;
    plannedAmount: number;
    actualAmount: number;
}
