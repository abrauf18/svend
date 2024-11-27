'use client';

import { User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Database } from '~/lib/database.types';
import { Budget, BudgetFinAccountTransaction, BudgetFinAccountTransactionTag } from '~/lib/model/budget.types';
import { CategoryGroup } from '~/lib/model/fin.types';

interface BudgetWorkspace {
  accounts: Database['public']['Views']['user_accounts']['Row'][];
  account: Database['public']['Functions']['team_account_workspace']['Returns'][0];
  user: User;
  budget: Budget;
  budgetTransactions: BudgetFinAccountTransaction[];
  budgetCategories: Record<string, CategoryGroup>;
  budgetTags: BudgetFinAccountTransactionTag[];
}

interface BudgetWorkspaceContextValue {
  workspace: BudgetWorkspace;
  updateBudgetOnboardingStep: (step: Database['public']['Tables']['budgets']['Row']['current_onboarding_step']) => void;
  updateTransaction: (transaction: BudgetFinAccountTransaction) => void;
  addBudgetTag: (tag: BudgetFinAccountTransactionTag) => void;
}

export const BudgetWorkspaceContext = createContext<BudgetWorkspaceContextValue>({} as BudgetWorkspaceContextValue);

export function useBudgetWorkspace() {
  return useContext(BudgetWorkspaceContext);
}

export function BudgetWorkspaceContextProvider(
  props: React.PropsWithChildren<{ value: BudgetWorkspace }>,
) {
  const [workspace, setWorkspace] = useState<BudgetWorkspace>(props.value);

  const updateBudgetOnboardingStep = useCallback((step: Database['public']['Tables']['budgets']['Row']['current_onboarding_step']) => {
    setWorkspace(prev => ({
      ...prev,
      budget: {
        ...prev.budget,
        onboardingStep: step
      }
    }));
  }, []);

  const updateTransaction = (budgetTransaction: BudgetFinAccountTransaction) => {
    setWorkspace(prev => ({
      ...prev,
      budgetTransactions: prev.budgetTransactions.map((t) =>
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
  
  useEffect(() => {
    console.log('Budget workspace updated:', workspace)
  }, [workspace]);

  return (
    <BudgetWorkspaceContext.Provider 
      value={{ 
        workspace,
        updateBudgetOnboardingStep,
        updateTransaction,
        addBudgetTag
      }}
    >
      {props.children}
    </BudgetWorkspaceContext.Provider>
  );
}
