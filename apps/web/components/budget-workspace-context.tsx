'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { User } from '@supabase/supabase-js';
import { Database } from '~/lib/database.types';
import { Budget, BudgetCategoryGroups, BudgetFinAccountRecurringTransaction, BudgetFinAccountTransaction, BudgetFinAccountTransactionTag, BudgetSpendingTrackingsByMonth } from '~/lib/model/budget.types';
import { Category, CategoryGroup } from '~/lib/model/fin.types';

interface BudgetWorkspace {
  accounts: Database['public']['Views']['user_accounts']['Row'][];
  account: Database['public']['Functions']['team_account_workspace']['Returns'][0];
  user: User;
  budget: Budget;
  budgetTransactions: BudgetFinAccountTransaction[];
  budgetRecurringTransactions: BudgetFinAccountRecurringTransaction[];
  budgetCategories: BudgetCategoryGroups;
  budgetTags: BudgetFinAccountTransactionTag[];
}

interface BudgetWorkspaceContextValue {
  workspace: BudgetWorkspace;
  updateBudgetOnboardingStep: (step: Database['public']['Tables']['budgets']['Row']['current_onboarding_step']) => void;
  updateTransaction: (transaction: BudgetFinAccountTransaction) => void;
  updateRecurringTransaction: (transaction: BudgetFinAccountRecurringTransaction) => void;
  addBudgetTag: (tag: BudgetFinAccountTransactionTag) => void;
  addBudgetCategoryGroup: (group: CategoryGroup) => void;
  addBudgetCategory: (groupId: string, category: Category) => void;
  updateCategoryGroupDescription: (
    groupId: string,
    description: string,
  ) => void;
  updateCategoryDescription: (
    groupId: string,
    categoryId: string,
    description: string,
  ) => void;
  updateBudgetSpending: (spendingTracking: BudgetSpendingTrackingsByMonth) => void;
}

export const BudgetWorkspaceContext =
  createContext<BudgetWorkspaceContextValue>({} as BudgetWorkspaceContextValue);

export function useBudgetWorkspace() {
  return useContext(BudgetWorkspaceContext);
}

export function BudgetWorkspaceContextProvider(
  props: React.PropsWithChildren<{ value: BudgetWorkspace }>,
) {
  const [workspace, setWorkspace] = useState<BudgetWorkspace>(props.value);

  const updateBudgetOnboardingStep = useCallback(
    (
      step: Database['public']['Tables']['budgets']['Row']['current_onboarding_step'],
    ) => {
      setWorkspace((prev) => ({
        ...prev,
        budget: {
          ...prev.budget,
          onboardingStep: step,
        },
      }));
    },
    [],
  );

  const addBudgetCategoryGroup = useCallback((group: CategoryGroup) => {
    // Reset workspace context with new group
    setWorkspace((prev) => ({
      ...prev,
      budgetCategories: {
        ...prev.budgetCategories,
        [group.name]: group,
      },
    }));
  }, []);

  const updateCategoryGroupDescription = useCallback(
    (groupId: string, description: string) => {
      setWorkspace((prev) => ({
        ...prev,
        budgetCategories: Object.fromEntries(
          Object.entries(prev.budgetCategories).map(([key, group]) => [
            key,
            group.id === groupId
              ? { ...group, description }
              : group
          ])
        ),
      }));
    },
    [],
  );

  const updateCategoryDescription = useCallback(
    (groupId: string, categoryId: string, description: string) => {
      setWorkspace((prev) => ({
        ...prev,
        budgetCategories: Object.fromEntries(
          Object.entries(prev.budgetCategories).map(([key, group]) => [
            key,
            group.id === groupId
              ? {
                  ...group,
                  categories: group.categories.map((cat) =>
                    cat.id === categoryId
                      ? { ...cat, description }
                      : cat
                  ),
                }
              : group
          ])
        ),
      }));
    },
    [],
  );

  const addBudgetCategory = useCallback((groupId: string, category: Category) => {
    setWorkspace((prev) => {
      // Find the group by ID instead of name
      const group = Object.values(prev.budgetCategories).find(g => g.id === groupId);
      if (!group) {
        console.error(`Group with ID ${groupId} not found`);
        return prev;
      }

      return {
        ...prev,
        budgetCategories: {
          ...prev.budgetCategories,
          [group.name]: {
            ...prev.budgetCategories[group.name]!,
            categories: [...prev.budgetCategories[group.name]!.categories, category],
          },
        },
      };
    });
  }, []);

  const updateTransaction = (budgetTransaction: BudgetFinAccountTransaction) => {
    setWorkspace(prev => ({
      ...prev,
      budgetTransactions: prev.budgetTransactions.map((t) =>
        t.transaction.id === budgetTransaction.transaction.id ? budgetTransaction : t
      ),
    }));
  };

  const updateRecurringTransaction = (budgetTransaction: BudgetFinAccountRecurringTransaction) => {
    setWorkspace(prev => ({
      ...prev,
      budgetRecurringTransactions: prev.budgetRecurringTransactions.map((t) =>
        t.transaction.id === budgetTransaction.transaction.id ? budgetTransaction : t
      ),
    }));
  };
  
  const addBudgetTag = (tag: BudgetFinAccountTransactionTag) => {
    setWorkspace(prev => ({
      ...prev,
      budgetTags: [...prev.budgetTags, tag]
    }));
  };
  
  const updateBudgetSpending = useCallback((spendingTracking: BudgetSpendingTrackingsByMonth) => {
    setWorkspace((prev) => ({
      ...prev,
      budget: {
        ...prev.budget,
        spendingTracking,
      },
    }));
  }, []);

  useEffect(() => {
    console.log('Budget workspace updated:', workspace);
  }, [workspace]);

  return (
    <BudgetWorkspaceContext.Provider
      value={{
        workspace,
        updateBudgetOnboardingStep,
        addBudgetCategoryGroup,
        addBudgetCategory,
        updateCategoryGroupDescription,
        updateCategoryDescription,
        updateTransaction,
        updateRecurringTransaction,
        addBudgetTag,
        updateBudgetSpending,
      }}
    >
      {props.children}
    </BudgetWorkspaceContext.Provider>
  );
}
