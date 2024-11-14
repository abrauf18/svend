'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { Database } from '@kit/supabase/database';

interface AccountWorkspace {
  accounts: Database['public']['Views']['user_accounts']['Row'][];
  account: Database['public']['Functions']['team_account_workspace']['Returns'][0];
  user: User;
  budget: Database['public']['Tables']['budgets']['Row'];
}

interface AccountWorkspaceContextValue {
  workspace: AccountWorkspace;
  updateBudgetOnboardingStep: (step: Database['public']['Tables']['budgets']['Row']['current_onboarding_step']) => void;
}

export const TeamAccountWorkspaceContext = createContext<AccountWorkspaceContextValue>({} as AccountWorkspaceContextValue);

export function useTeamAccountWorkspace() {
  return useContext(TeamAccountWorkspaceContext);
}

export function TeamAccountWorkspaceContextProvider(
  props: React.PropsWithChildren<{ value: AccountWorkspace }>,
) {
  const [workspace, setWorkspace] = useState<AccountWorkspace>(props.value);

  const updateBudgetOnboardingStep = useCallback((step: Database['public']['Tables']['budgets']['Row']['current_onboarding_step']) => {
    setWorkspace(prev => ({
      ...prev,
      budget: {
        ...prev.budget,
        current_onboarding_step: step
      }
    }));
  }, []);

  useEffect(() => {
    console.log('Workspace updated:', workspace)
  }, [workspace]);

  return (
    <TeamAccountWorkspaceContext.Provider 
      value={{ 
        workspace,
        updateBudgetOnboardingStep
      }}
    >
      {props.children}
    </TeamAccountWorkspaceContext.Provider>
  );
}
