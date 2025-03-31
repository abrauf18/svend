'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useMemo,
} from 'react';

import { User } from '@supabase/supabase-js';
import { Database } from '~/lib/database.types';
import { Budget, BudgetCategoryGroups, BudgetFinAccountRecurringTransaction, BudgetFinAccountTransaction, BudgetFinAccountTransactionTag, BudgetRule, BudgetSpendingTrackingsByMonth } from '~/lib/model/budget.types';
import { Category, CategoryCompositionData, CategoryGroup } from '~/lib/model/fin.types';

interface BudgetWorkspace {
  accounts: Database['public']['Views']['user_accounts']['Row'][];
  account: Database['public']['Functions']['team_account_workspace']['Returns'][0];
  user: User;
  budget: Budget;
  budgetTransactions: BudgetFinAccountTransaction[];
  budgetRecurringTransactions: BudgetFinAccountRecurringTransaction[];
  budgetCategories: BudgetCategoryGroups;
  budgetTags: BudgetFinAccountTransactionTag[];
  budgetRules: BudgetRule[];
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
  updateBudgetSpending: (spendingTracking: BudgetSpendingTrackingsByMonth) => void;
  updateCategory: (
    groupId: string,
    categoryId: string,
    updateData: CategoryUpdateData
  ) => void;
  updateBudgetRuleOrder: (ruleIds: string[]) => void;
  addBudgetRule: (newRule: BudgetRule) => void;
  deleteBudgetRule: (ruleId: string) => void;
}

export const BudgetWorkspaceContext =
  createContext<BudgetWorkspaceContextValue>({} as BudgetWorkspaceContextValue);

export function useBudgetWorkspace() {
  return useContext(BudgetWorkspaceContext);
}

export function BudgetWorkspaceContextProvider(
  props: React.PropsWithChildren<{ value: BudgetWorkspace }>,
) {
  // Initialize workspace with properly ordered rules
  const [workspace, setWorkspace] = useState<BudgetWorkspace>(() => {
    const ruleOrder = props.value.budget.ruleOrder || [];
    const ruleMap = new Map(props.value.budgetRules.map(rule => [rule.id, rule]));
    
    // Create ordered rules array based on ruleOrder
    const orderedRules = ruleOrder
      .map(id => ruleMap.get(id))
      .filter((rule): rule is BudgetRule => rule !== undefined);
    
    // Add any rules that aren't in ruleOrder at the end
    const unorderedRules = props.value.budgetRules.filter(
      rule => !ruleOrder.includes(rule.id)
    );

    return {
      ...props.value,
      budgetRules: [...orderedRules, ...unorderedRules],
      budget: {
        ...props.value.budget,
        ruleOrder: [...orderedRules, ...unorderedRules].map(rule => rule.id)
      }
    };
  });

  const updateBudgetRuleOrder = useCallback((ruleIds: string[]) => {
    setWorkspace(prev => {
      // Validate that we have the same rules (just in different order)
      const currentRuleIds = new Set(prev.budget.ruleOrder || []);
      const newRuleIds = new Set(ruleIds);
  
      // Check if sets have same size and contain same elements
      const hasAllRules = currentRuleIds.size === newRuleIds.size && 
        [...currentRuleIds].every(id => newRuleIds.has(id));
  
      if (!hasAllRules) {
        console.warn(
          'Rule order update failed: New rule IDs do not match current rules',
          {
            current: [...currentRuleIds],
            received: [...newRuleIds]
          }
        );
        return prev;
      }
  
      // Create a map of rule id to rule object for quick lookup
      const ruleMap = new Map(prev.budgetRules.map(rule => [rule.id, rule]));
      
      // Create new ordered rules array based on ruleIds
      const orderedRules = ruleIds
        .map(id => ruleMap.get(id))
        .filter((rule): rule is BudgetRule => rule !== undefined);
  
      return {
        ...prev,
        budget: {
          ...prev.budget,
          ruleOrder: ruleIds
        },
        budgetRules: orderedRules
      };
    });
  }, []);

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
    (
      groupId: string, 
      categoryId: string, 
      description: string,
      compositeData?: {
        isComposite: boolean;
        compositionCategories: CategoryCompositionData[] | null;
      }
    ) => {
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
                      ? { 
                          ...cat, 
                          description,
                          ...(compositeData && {
                            isComposite: compositeData.isComposite,
                            compositeData: compositeData.compositionCategories
                          })
                        }
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
            categories: [...prev.budgetCategories[group.name]!.categories, {
              ...category,
              isComposite: category.isComposite ?? false,
              compositeData: category.compositeData ?? undefined,
            }],
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

  const updateCategory = useCallback(
    (groupId: string, categoryId: string, updateData: CategoryUpdateData) => {
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
                      ? { 
                          ...cat,
                          ...(updateData.description !== undefined && { 
                            description: updateData.description 
                          }),
                          ...(updateData.isComposite !== undefined && { 
                            isComposite: updateData.isComposite 
                          }),
                          ...(updateData.compositeData !== undefined && { 
                            compositeData: updateData.compositeData 
                          })
                        }
                      : cat
                  ),
                }
              : group
          ])
        ),
      }));
    },
    []
  );

  const addBudgetRule = useCallback((newRule: BudgetRule) => {
    setWorkspace(prev => ({
      ...prev,
      budget: {
        ...prev.budget,
        ruleOrder: [...(prev.budget.ruleOrder || []), newRule.id]
      },
      budgetRules: [...prev.budgetRules, newRule]
    }));
  }, []);

  const deleteBudgetRule = useCallback((ruleId: string) => {
    setWorkspace(prev => ({
      ...prev,
      budget: {
        ...prev.budget,
        ruleOrder: prev.budget.ruleOrder.filter(id => id !== ruleId)
      },
      budgetRules: prev.budgetRules.filter(rule => rule.id !== ruleId)
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
        updateTransaction,
        updateRecurringTransaction,
        addBudgetTag,
        updateBudgetSpending,
        updateCategory,
        updateBudgetRuleOrder,
        addBudgetRule,
        deleteBudgetRule
      }}
    >
      {props.children}
    </BudgetWorkspaceContext.Provider>
  );
}

interface CategoryUpdateData {
  description?: string;
  isComposite?: boolean;
  compositeData?: CategoryCompositionData[] | null;
}
