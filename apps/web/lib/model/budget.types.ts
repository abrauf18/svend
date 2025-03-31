import { Database } from '../database.types';
import { Category, CategoryGroup, FinAccount, FinAccountRecurringTransaction, FinAccountTransaction } from './fin.types';

export type Budget = {
  id: string;
  budgetType: string;
  spendingTracking: BudgetSpendingTrackingsByMonth;
  spendingRecommendations: BudgetSpendingRecommendations;
  ruleOrder: string[];
  goals: BudgetGoal[];
  onboardingStep?: Database['public']['Tables']['budgets']['Row']['current_onboarding_step'];
  linkedFinAccounts: Array<FinAccount>;
  name: string;
}

export interface BudgetFinAccountTransaction {
  transaction: FinAccountTransaction;
  budgetFinAccountId: string; // UUID referencing the financial account link to the budget
  categoryGroupId: string; // UUID referencing the group of the category associated with the transaction
  categoryGroup: string; // Group of the category associated with the transaction
  category: Category;
  merchantName: string; // Name of the merchant involved in the transaction
  payee: string; // Name of the payee for the transaction
  notes: string; // Notes for the transaction
  budgetTags: BudgetFinAccountTransactionTag[]; // Tags associated with the transaction
  budgetAttachmentsStorageNames: string[]; // Storage names for attachments
}

export interface BudgetFinAccountRecurringTransaction {
  transaction: FinAccountRecurringTransaction;
  budgetFinAccountId: string; // UUID referencing the financial account link to the budget
  categoryGroupId?: string; // UUID referencing the group of the category associated with the transaction
  categoryGroup?: string; // Group of the category associated with the transaction
  categoryId?: string; // UUID referencing the category associated with the transaction
  category?: string; // Name of the category associated with the transaction
  notes: string; // Notes for the transaction
  budgetTags: BudgetFinAccountTransactionTag[]; // Tags associated with the transaction
}

export interface BudgetFinAccountTransactionTag {
  id: string;
  name: string;
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

export type BudgetGoalType = 'savings' | 'debt' | 'investment' | 'charity';

export interface BudgetGoal {
  id: string;
  budgetId: string;
  type: BudgetGoalType;
  name: string;
  amount: number;
  balance: number;
  description?: string;
  budgetFinAccountId: string;
  budgetFinAccountBalance?: number;
  targetDate: string;
  spendingRecommendations: BudgetGoalSpendingRecommendations;
  spendingTracking: BudgetGoalSpendingTrackingsByMonth;
  debtPaymentComponent?: 'principal' | 'interest' | 'principal_interest';
  debtInterestRate?: number;
  plaidAccountId?: string;
  manualAccountId?: string;
  // For savings and debt goals only
  subType?: string;
  // Common fields
  createdAt?: string;
  updatedAt?: string;
}

// The key is the category group name
export type BudgetSpendingRecommendations = {
  balanced: Record<string, BudgetSpendingCategoryGroupRecommendation>;
  conservative: Record<string, BudgetSpendingCategoryGroupRecommendation>;
  relaxed: Record<string, BudgetSpendingCategoryGroupRecommendation>;
};

export type BudgetSpendingCategoryGroupRecommendation = {
  groupName: string;
  groupId?: string;
  targetSource: 'group' | 'category';
  recommendation: number;
  spending: number;
  categories: Array<BudgetSpendingCategoryRecommendation>;
}

export type BudgetSpendingCategoryRecommendation = {
  categoryName: string;
  categoryId?: string;
  spending: number; // total spending for the category from rolling month used to calculate recommendation
  recommendation: number; // recommendation for the category calculated from rolling month
}

// The key is the group name
export type BudgetCategoryGroups = Record<string, CategoryGroup>;

/**
 * Represents the spending tracking categorized by month and group.
 * The outer key is a month date string in the format 'yyyy-MM',
 * and the inner key is the group name.
 */
export type BudgetSpendingTrackingsByMonth = Record<string, Record<string, BudgetSpendingCategoryGroupTracking>>;

export type BudgetSpendingCategoryGroupTracking = {
  groupName: string;
  groupId?: string;
  targetSource: 'group' | 'category';
  spendingActual: number;
  spendingTarget: number;
  isTaxDeductible: boolean;
  categories: Array<BudgetSpendingCategoryTracking>;
}

export type BudgetSpendingCategoryTracking = {
  categoryName: string;
  categoryId?: string;
  spendingActual: number;
  spendingTarget: number;
  isTaxDeductible: boolean;
}

export type BudgetGoalSpendingRecommendations = {
  balanced: BudgetGoalSpendingRecommendation;
  conservative: BudgetGoalSpendingRecommendation;
  relaxed: BudgetGoalSpendingRecommendation;
};

export type BudgetGoalSpendingRecommendation = {
  goalId: string;
  // The key is the month in the format 'yyyy-MM'
  monthlyAmounts: Record<string, number>;
}

/**
 * Represents the goal tracking categorized by month.
 * The key is a month date string in the format 'yyyy-MM'
 */
export type BudgetGoalSpendingTrackingsByMonth = Record<string, BudgetGoalMonthlyTracking>;

export type BudgetGoalMonthlyTracking = {
  month: string;
  startingBalance: number;
  endingBalance?: number;
  // The key is a date string in the format 'yyyy-MM-dd'
  allocations: Record<string, BudgetGoalSpendingAllocation>;
}

export type BudgetGoalSpendingAllocation = {
  dateTarget: string;
  amountTarget: number;
  dateActual?: string;
  amountActual?: number;
}

// BudgetGoalMultiRecommendations is a model for grouped recommendations for multiple goals
// The key is the goal id
export type BudgetGoalMultiRecommendations = {
  balanced: Record<string, BudgetGoalSpendingRecommendation>;
  conservative: Record<string, BudgetGoalSpendingRecommendation>;
  relaxed: Record<string, BudgetGoalSpendingRecommendation>;
};

export interface BudgetRule {
  id: string;
  budgetId: string;
  name: string;
  isActive: boolean;
  conditions: {
    merchantName?: {
      enabled: boolean;
      matchType?: 'contains' | 'exactly';
      value?: string;
    };
    amount?: {
      enabled: boolean;
      type?: 'expenses' | 'income';
      matchType?: 'exactly' | 'between';
      value?: string;
      rangeStart?: string;
      rangeEnd?: string;
    };
    date?: {
      enabled: boolean;
      matchType?: 'between' | 'exactly';
      value?: number;
      rangeStart?: number;
      rangeEnd?: number;
    };
    account?: {
      enabled: boolean;
      value?: string;
    };
  };
  actions: {
    renameMerchant?: {
      enabled: boolean;
      value?: string;
    };
    setNote?: {
      enabled: boolean;
      value?: string;
    };
    setCategory?: {
      enabled: boolean;
      value?: string;
    };
    addTags?: {
      enabled: boolean;
      value?: string[];
    };
  };
  createdAt: string;
  updatedAt: string;
}

