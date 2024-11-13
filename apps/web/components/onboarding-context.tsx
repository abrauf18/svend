'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  OnboardingState,
  AccountOnboardingPlaidConnectionItem,
  AccountOnboardingStepContextKey,
  accountOnboardingSteps,
  accountOnboardingStepContextKeys,
  AccountOnboardingPlaidItemAccount,
  AccountOnboardingState,
} from '../lib/model/onboarding.types';

import { ProfileData } from '../lib/model/fin.types';
import { Budget, BudgetGoal } from '../lib/model/budget.types';

import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';

export type OnboardingContextType = {
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
  accountNextStep: () => void;
  accountPrevStep: () => void;
  accountPlaidConnItemAddOne: (
    plaidConnectionItem: AccountOnboardingPlaidConnectionItem,
  ) => void;
  accountPlaidConnItemRemoveOne: (svendItemId: string) => void;
  accountPlaidItemAccountLinkOne: (svendItemId: string, svendAccountId: string, budgetFinAccountId: string) => void;
  accountPlaidItemAccountUnlinkOne: (svendItemId: string, svendAccountId: string) => void;
  accountProfileDataUpdate: (
    profileData: ProfileData,
  ) => void;
  accountBudgetUpdate: (
    budget: Budget,
  ) => void;
  accountBudgetGoalsAddOne: (
    budgetGoal: BudgetGoal,
  ) => void;
  accountChangeStepContextKey: (
    contextKey: AccountOnboardingStepContextKey,
  ) => void;
};

export const OnboardingContext = createContext<
  OnboardingContextType | undefined
>(undefined);

export const useOnboardingContext = () => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error(
      'useOnboardingContext must be used within an OnboardingProvider',
    );
  }
  return context;
};

export function OnboardingContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<OnboardingState>({
    account: {
      contextKey: undefined,
      budget: {
        id: '',
        budgetType: '',
        categoryGroupSpending: {},
        recommendedCategoryGroupSpending: {},
        goals: [],
      } as Budget,
      userId: undefined,
    } as AccountOnboardingState,
  });

  useEffect(() => {
    console.log('updated state', state);
  }, [state]);

  const fetchAccountOnboardingState = useMemo(() => {
    return async () => {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // setState((prevState) => ({
        //   ...prevState,
        //   account: {
        //     ...prevState.account,
        //     userId: user.id,
        //   },
        // }));

        const response = await fetch('/api/onboarding/account/state');
        if (!response.ok) {
          const error = await response.json();
          console.error('Error fetching account onboarding state:', error);
          return null;
        }
        const { accountOnboardingState } = await response.json();
        return accountOnboardingState;
      }
      return null;
    };
  }, []);

  useEffect(() => {
    fetchAccountOnboardingState().then((accountOnboardingState) => {
      if (accountOnboardingState) {
        setState((prevState: OnboardingState) => ({
          ...prevState,
          account: accountOnboardingState,
        }));
      }
    });
  }, [fetchAccountOnboardingState]);

  const accountNextStep = async () => {
    const prevState = state.account;
    console.log('updating state >> prevState.contextKey', prevState.contextKey);
    const prevStepIdx = accountOnboardingSteps.findIndex((step: { contextKeys: AccountOnboardingStepContextKey[] }) =>
      step.contextKeys.includes(
        prevState.contextKey as AccountOnboardingStepContextKey,
      ),
    );
    const nextStepIndex = Math.min(
      prevStepIdx + 1,
      accountOnboardingStepContextKeys.length - 1,
    );
    let newStateAccount = {
      ...prevState,
      currentStepIdx: nextStepIndex,
      contextKey: accountOnboardingSteps[nextStepIndex]?.contextKeys[0],
    };

    // TODO: remove this as the only call left after goals form is db wired should be transition to 'profile_goals' and this can be handled in the step 1 next button
    const updateContextKeyInDatabase = async (
      contextKey: AccountOnboardingStepContextKey,
    ) => {
      if (state.account.userId && state.account.contextKey) {
        const response = await fetch('/api/onboarding/account/state', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contextKey: contextKey,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('Error updating context key:', error);
          throw new Error('Error updating context key:', error);
        }
      }
    };

    console.log(
      'updating state >> newState.contextKey',
      newStateAccount.contextKey,
    );

    if (
      ['profile_goals', 'analyze_spending'].includes(
        newStateAccount.contextKey as AccountOnboardingStepContextKey,
      )
    ) {
      try {
        await updateContextKeyInDatabase(
          newStateAccount.contextKey as AccountOnboardingStepContextKey,
        );
      } catch (error) {
        return;
      }
    }

    // udpate state
    setState((prevState: OnboardingState) => ({
      ...prevState,
      account: newStateAccount,
    }));
  };

  const accountPrevStep = () => {
    setState((prevState: OnboardingState) => {
      const currentIndex = accountOnboardingStepContextKeys.indexOf(
        prevState.account.contextKey as AccountOnboardingStepContextKey,
      );
      let currentStep = accountOnboardingSteps.find((step: { contextKeys: AccountOnboardingStepContextKey[] }) =>
        step.contextKeys.includes(
          prevState.account.contextKey as AccountOnboardingStepContextKey,
        ),
      );
      let prevIndex = currentIndex - 1;
      while (
        prevIndex < accountOnboardingStepContextKeys.length &&
        !currentStep?.contextKeys.includes(
          accountOnboardingStepContextKeys[
            prevIndex
          ] as AccountOnboardingStepContextKey,
        )
      ) {
        prevIndex--;
      }
      prevIndex = Math.max(prevIndex + 1, 0);
      let newStateAccount = {
        ...prevState.account,
        currentStepIdx: prevIndex,
        contextKey: accountOnboardingStepContextKeys[prevIndex],
      };
      return {
        ...prevState,
        account: newStateAccount,
      };
    });
  };

  const accountPlaidConnItemAddOne = (
    plaidConnectionItem: AccountOnboardingPlaidConnectionItem,
  ) => {
    setState((prevState: OnboardingState) => {
      let newStateAccount = {
        ...prevState.account,
        plaidConnectionItems: [
          ...(prevState.account.plaidConnectionItems || []),
          plaidConnectionItem,
        ],
      };
      return {
        ...prevState,
        account: newStateAccount,
      };
    });
  };

  const accountPlaidConnItemRemoveOne = (svendItemId: string) => {
    setState((prevState: OnboardingState) => ({
      ...prevState,
      account: {
        ...prevState.account,
        plaidConnectionItems: (prevState.account.plaidConnectionItems ?? []).filter(
          (item: AccountOnboardingPlaidConnectionItem) => item.svendItemId !== svendItemId
        ),
      },
    }));
  };

  const accountPlaidItemAccountLinkOne = (svendItemId: string, svendAccountId: string, budgetFinAccountId: string) => {
    setState((prevState: OnboardingState) => ({
      ...prevState,
      account: {
        ...prevState.account,
        plaidConnectionItems: (prevState.account.plaidConnectionItems ?? []).map((item: AccountOnboardingPlaidConnectionItem) =>
          item.svendItemId === svendItemId
            ? {
                ...item,
                itemAccounts: item.itemAccounts.map((account: AccountOnboardingPlaidItemAccount) =>
                  account.svendAccountId === svendAccountId
                    ? { ...account, budgetFinAccountId: budgetFinAccountId }
                    : account
                ),
              }
            : item
        ),
      },
    }));
  };

  const accountPlaidItemAccountUnlinkOne = (svendItemId: string, svendAccountId: string) => {
    setState((prevState: OnboardingState) => ({
      ...prevState,
      account: {
        ...prevState.account,
        plaidConnectionItems: (prevState.account.plaidConnectionItems ?? []).map((item: AccountOnboardingPlaidConnectionItem) =>
          item.svendItemId === svendItemId
            ? {
                ...item,
                itemAccounts: item.itemAccounts.map((account: AccountOnboardingPlaidItemAccount) =>
                  account.svendAccountId === svendAccountId
                    ? { ...account, budgetFinAccountId: null }
                    : account
                ),
              }
            : item
        ),
      },
    }));
  };

  const accountProfileDataUpdate = (
    profileData: ProfileData,
  ) => {
    setState((prevState: OnboardingState) => ({
      ...prevState,
      account: {
        ...prevState.account,
        profileData,
      },
    }));
  };

  const accountBudgetUpdate = (
    budget: Budget,
  ) => {
    setState((prevState: OnboardingState) => {
      const newState = {
        ...prevState,
        account: {
          ...prevState.account,
          budget
        },
      };

      console.log('onboarding context >> accountBudgetUpdateSpending, newState', newState);

      return newState;
    });
  };

  const accountBudgetGoalsAddOne = (
    budgetGoal: BudgetGoal,
  ) => {
    setState((prevState: OnboardingState) => ({
      ...prevState,
      account: {
        ...prevState.account,
        budget: {
          ...prevState.account.budget,
          goals: [
            ...(prevState.account.budget?.goals || []),
            budgetGoal,
          ],
        },
      },
    }));
  };

  const accountChangeStepContextKey = (
    contextKey: AccountOnboardingStepContextKey,
  ): boolean => {
    let success = false;
    setState((prevState: OnboardingState) => {
      const currentStep = accountOnboardingSteps.find((step: { contextKeys: AccountOnboardingStepContextKey[] }) =>
        step.contextKeys.includes(
          prevState.account.contextKey as AccountOnboardingStepContextKey,
        ),
      );
      if (currentStep && currentStep.contextKeys.includes(contextKey)) {
        success = true;
        return {
          ...prevState,
          account: {
            ...prevState.account,
            contextKey: contextKey,
          },
        };
      }
      return prevState;
    });
    return success;
  };

  return (
    <OnboardingContext.Provider
      value={{
        state,
        setState,
        accountNextStep,
        accountPrevStep,
        accountPlaidConnItemAddOne,
        accountPlaidConnItemRemoveOne,
        accountPlaidItemAccountLinkOne,
        accountPlaidItemAccountUnlinkOne,
        accountProfileDataUpdate,
        accountBudgetUpdate,
        accountBudgetGoalsAddOne,
        accountChangeStepContextKey,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

// export function useOnboarding() {
//   const context = useContext(OnboardingContext);
//   if (context === undefined) {
//     throw new Error('useOnboarding must be used within an OnboardingProvider');
//   }
//   return context;
// }
