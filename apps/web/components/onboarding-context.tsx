'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';

// Define the enum for onboarding steps
export type AccountOnboardingStepContextKey =
  | 'start'
  | 'plaid'
  | 'profile_goals'
  | 'analyze_spending'
  | 'analyze_spending_in_progress'
  | 'budget_setup'
  | 'end';

export const AccountOnboardingStepContextKeys: Readonly<
  Array<AccountOnboardingStepContextKey>
> = [
  'start',
  'plaid',
  'profile_goals',
  'analyze_spending',
  'analyze_spending_in_progress',
  'budget_setup',
  'end',
];

export const accountOnboardingSteps: Array<{
  contextKeys: Array<AccountOnboardingStepContextKey>;
}> = [
  {
    contextKeys: ['start', 'plaid'],
  },
  {
    contextKeys: ['profile_goals'],
  },
  {
    contextKeys: ['analyze_spending', 'analyze_spending_in_progress'],
  },
  {
    contextKeys: ['budget_setup', 'end'],
  },
];

export type AccountOnboardingPlaidConnectionItem = {
  svendItemId: string;
  plaidItemId: string;
  institutionName: string;
  institutionLogoSignedUrl: string;
  accessToken?: string;
  nextCursor?: string;
  itemAccounts: AccountOnboardingPlaidItemAccount[];
};

export type AccountOnboardingPlaidItemAccount = {
  svendAccountId: string;
  svendItemId: string;
  ownerAccountId: string;
  plaidAccountId: string;
  accountName: string;
  accountType: string;
  accountSubType: string;
  mask: string;
};

export type AccountOnboardingState = {
  budgetId?: string;
  contextKey?: AccountOnboardingStepContextKey;
  userId?: string;
  plaidConnectionItems?: AccountOnboardingPlaidConnectionItem[];
};

export type OnboardingState = {
  account: AccountOnboardingState;
};

export type OnboardingContextType = {
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
  accountNextStep: () => void;
  accountPrevStep: () => void;
  accountPlaidConnItemAddOne: (
    plaidConnectionItem: AccountOnboardingPlaidConnectionItem,
  ) => void;
  accountPlaidConnItemAccountRemoveOne: (
    svendItemId: string,
    svendPlaidAccountId: string,
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
      budgetId: undefined,
      userId: undefined,
    },
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
        setState((prevState) => ({
          ...prevState,
          account: {
            ...prevState.account,
            userId: user.id,
          },
        }));

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
        setState((prevState) => ({
          ...prevState,
          account: accountOnboardingState,
        }));
      }
    });
  }, [fetchAccountOnboardingState]);

  const accountNextStep = async () => {
    const prevState = state.account;
    console.log('updating state >> prevState.contextKey', prevState.contextKey);
    const prevStepIdx = accountOnboardingSteps.findIndex((step) =>
      step.contextKeys.includes(
        prevState.contextKey as AccountOnboardingStepContextKey,
      ),
    );
    const nextStepIndex = Math.min(
      prevStepIdx + 1,
      AccountOnboardingStepContextKeys.length - 1,
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
    setState((prevState) => ({
      ...prevState,
      account: newStateAccount,
    }));
  };

  const accountPrevStep = () => {
    setState((prevState) => {
      const currentIndex = AccountOnboardingStepContextKeys.indexOf(
        prevState.account.contextKey as AccountOnboardingStepContextKey,
      );
      let currentStep = accountOnboardingSteps.find((step) =>
        step.contextKeys.includes(
          prevState.account.contextKey as AccountOnboardingStepContextKey,
        ),
      );
      let prevIndex = currentIndex - 1;
      while (
        prevIndex < AccountOnboardingStepContextKeys.length &&
        !currentStep?.contextKeys.includes(
          AccountOnboardingStepContextKeys[
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
        contextKey: AccountOnboardingStepContextKeys[prevIndex],
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
    setState((prevState) => {
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

  const accountPlaidConnItemAccountRemoveOne = (
    svendItemId: string,
    svendPlaidAccountId: string,
  ) => {
    setState((prevState) => {
      let newStateAccount = {
        ...prevState.account,
        plaidConnectionItems: (
          prevState.account.plaidConnectionItems || []
        ).map((item) => {
          // Check if the current item matches the given plaidAccountItemId
          if (item.svendItemId === svendItemId) {
            return {
              ...item,
              // Filter out the account with the given plaidAccountId
              itemAccounts: (item.itemAccounts || []).filter(
                (account) => account.svendAccountId !== svendPlaidAccountId,
              ),
            };
          }
          // Return the item unchanged if it doesn't match the plaidAccountItemId
          return item;
        }),
      };
      return {
        ...prevState,
        account: newStateAccount,
      };
    });
  };

  const accountChangeStepContextKey = (
    contextKey: AccountOnboardingStepContextKey,
  ): boolean => {
    let success = false;
    setState((prevState) => {
      const currentStep = accountOnboardingSteps.find((step) =>
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
        accountPlaidConnItemAccountRemoveOne,
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
