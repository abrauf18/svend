'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  Budget,
  BudgetCategoryGroups,
  BudgetGoal,
  BudgetSpendingRecommendations,
  BudgetSpendingTrackingsByMonth,
} from '../lib/model/budget.types';
import { FinAccount, FinAccountTransaction, ProfileData } from '../lib/model/fin.types';
import {
  AccountOnboardingManualInstitution,
  AccountOnboardingManualInstitutionAccount,
  AccountOnboardingPlaidConnectionItem,
  AccountOnboardingPlaidItemAccount,
  AccountOnboardingState,
  AccountOnboardingStepContextKey,
  accountOnboardingStepContextKeys,
  accountOnboardingSteps,
  OnboardingState,
} from '../lib/model/onboarding.types';

import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';

export type OnboardingContextType = {
  state: OnboardingState;
  accountNextStep: () => void;
  accountPrevStep: () => void;
  accountPlaidConnItemAddOne: (
    plaidConnectionItem: AccountOnboardingPlaidConnectionItem,
  ) => void;
  accountPlaidConnItemRemoveOne: (svendItemId: string) => void;
  accountPlaidItemAccountLinkOne: (
    svendItemId: string,
    svendAccountId: string,
    budgetFinAccountId: string,
  ) => void;
  accountPlaidItemAccountUnlinkOne: (
    svendItemId: string,
    svendAccountId: string,
  ) => void;
  accountManualAccountDeleteOne: (accountId: string) => void;
  accountManualAccountAddOne: (
    institutionId: string,
    account: AccountOnboardingManualInstitutionAccount,
  ) => void;
  accountManualAccountUpdateOne: (
    accountId: string,
    institutionId: string,
    data: { name: string; type: string; mask: string; balanceCurrent: number },
  ) => void;
  accountManualInstitutionsAddOne: (
    institution: AccountOnboardingManualInstitution,
  ) => void;
  accountManualInstitutionsAddMany: (
    institutions: AccountOnboardingManualInstitution[],
  ) => void;
  accountManualInstitutionsDeleteOne: (institutionId: string) => void;
  accountManualInstitutionsLinkAccount: (
    accountId: string,
    budgetFinAccountId: string,
  ) => void;
  accountManualInstitutionsUnlinkAccount: (accountId: string) => void;
  accountManualInstitutionsUpdateOne: (
    institutionId: string,
    data: { name: string; symbol: string },
  ) => void;
  accountManualTransactionUpdate: (
    transactionId: string,
    data: {
      date: string;
      amount: string;
      svend_category_id: string;
      manual_account_id: string;
      user_tx_id: string;
      merchant_name?: string;
      tx_status?: 'pending' | 'posted';
    },
  ) => void;
  accountManualTransactionCreateOne: (
    accountId: string,
    data: FinAccountTransaction,
  ) => void;
  accountManualTransactionDeleteOne: (transactionId: string) => void;
  accountProfileDataUpdate: (profileData: ProfileData) => void;
  accountBudgetUpdate: (budget: Budget) => void;
  accountBudgetGoalsAddOne: (budgetGoal: BudgetGoal) => void;
  accountChangeStepContextKey: (
    contextKey: AccountOnboardingStepContextKey,
  ) => void;
  accountTransactionsPanelSetSelectedAccount: (accountId: string) => void;
  accountTransactionsSideMenuSetSelectedTransaction: (
    transactionId: string | undefined,
  ) => void;
  accountSetStepContext: (newContextKey: AccountOnboardingStepContextKey) => void;
  accountBudgetSetLinkedFinAccounts: (linkedFinAccounts: FinAccount[]) => void;
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
        spendingTracking: {} as BudgetSpendingTrackingsByMonth,
        spendingRecommendations: {
          balanced: {},
          conservative: {},
          relaxed: {},
        } as BudgetSpendingRecommendations,
        goals: [],
        onboardingStep: 'start',
        linkedFinAccounts: [],
        categoryGroups: {} as BudgetCategoryGroups,
      } as Budget,
      userId: undefined,
      svendCategoryGroups: {} as BudgetCategoryGroups,
    } as AccountOnboardingState,
  });

  useEffect(() => {
    console.log('updated state', state);
  }, [state]);

  const fetchAccountOnboardingState = useCallback(async () => {
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
      const { accountOnboardingState } = (await response.json()) as {
        accountOnboardingState: AccountOnboardingState;
      };

      return accountOnboardingState;
    }
    return null;
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
    const prevStepIdx = accountOnboardingSteps.findIndex(
      (step: { contextKeys: AccountOnboardingStepContextKey[] }) =>
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

    if (newStateAccount.contextKey == 'manual') {
      // transition to next step
      accountNextStep();
      return;
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
      let currentStep = accountOnboardingSteps.find(
        (step: { contextKeys: AccountOnboardingStepContextKey[] }) =>
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
        plaidConnectionItems: (
          prevState.account.plaidConnectionItems ?? []
        ).filter(
          (item: AccountOnboardingPlaidConnectionItem) =>
            item.svendItemId !== svendItemId,
        ),
      },
    }));
  };

  const accountPlaidItemAccountLinkOne = (
    svendItemId: string,
    svendAccountId: string,
    budgetFinAccountId: string,
  ) => {
    setState((prevState: OnboardingState) => ({
      ...prevState,
      account: {
        ...prevState.account,
        plaidConnectionItems: (
          prevState.account.plaidConnectionItems ?? []
        ).map((item: AccountOnboardingPlaidConnectionItem) =>
          item.svendItemId === svendItemId
            ? {
                ...item,
                itemAccounts: item.itemAccounts.map(
                  (account: AccountOnboardingPlaidItemAccount) =>
                    account.svendAccountId === svendAccountId
                      ? { ...account, budgetFinAccountId: budgetFinAccountId }
                      : account,
                ),
              }
            : item,
        ),
      },
    }));
  };

  const accountPlaidItemAccountUnlinkOne = (
    svendItemId: string,
    svendAccountId: string,
  ) => {
    setState((prevState: OnboardingState) => ({
      ...prevState,
      account: {
        ...prevState.account,
        plaidConnectionItems: (
          prevState.account.plaidConnectionItems ?? []
        ).map((item: AccountOnboardingPlaidConnectionItem) =>
          item.svendItemId === svendItemId
            ? {
                ...item,
                itemAccounts: item.itemAccounts.map(
                  (account: AccountOnboardingPlaidItemAccount) =>
                    account.svendAccountId === svendAccountId
                      ? { ...account, budgetFinAccountId: null }
                      : account,
                ),
              }
            : item,
        ),
      },
    }));
  };

  const accountProfileDataUpdate = (profileData: ProfileData) => {
    setState((prevState: OnboardingState) => ({
      ...prevState,
      account: {
        ...prevState.account,
        profileData,
      },
    }));
  };

  const accountBudgetUpdate = (budget: Budget) => {
    setState((prevState: OnboardingState) => {
      const newState = {
        ...prevState,
        account: {
          ...prevState.account,
          budget,
        },
      };

      console.log(
        'onboarding context >> accountBudgetUpdateSpending, newState',
        newState,
      );

      return newState;
    });
  };

  const accountBudgetGoalsAddOne = (budgetGoal: BudgetGoal) => {
    setState((prevState: OnboardingState) => {
      const existingGoals = prevState.account.budget?.goals || [];
      
      // Check if goal with same ID already exists
      if (existingGoals.some(goal => goal.id === budgetGoal.id)) {
        // If it exists, don't add it again
        return prevState;
      }

      // If it's a new goal, add it
      return {
        ...prevState,
        account: {
          ...prevState.account,
          budget: {
            ...prevState.account.budget,
            goals: [...existingGoals, budgetGoal],
          },
        },
      };
    });
  };

  const accountChangeStepContextKey = (
    contextKey: AccountOnboardingStepContextKey,
  ): boolean => {
    let success = false;

    setState((prevState: OnboardingState) => {
      const currentStep = accountOnboardingSteps.find(
        (step: { contextKeys: AccountOnboardingStepContextKey[] }) =>
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

  const accountManualInstitutionsAddOne = (
    institution: AccountOnboardingManualInstitution,
  ) => {
    setState((prevState: OnboardingState) => ({
      ...prevState,
      account: {
        ...prevState.account,
        manualInstitutions: [
          ...(prevState.account.manualInstitutions || []),
          institution,
        ],
      },
    }));
  };

  const accountManualInstitutionsAddMany = (
    institutions: AccountOnboardingManualInstitution[],
  ) => {
    console.log('accountManualInstitutionsAddMany called with:', institutions);
    
    setState((prevState: OnboardingState) => {
      console.log('Current state institutions:', prevState.account.manualInstitutions);
      const existingInstitutions = prevState.account.manualInstitutions ?? [];
      
      // Create a map of existing institutions by normalized name+symbol
      const institutionsMap = new Map(
        existingInstitutions.map(inst => [
          `${(inst.name || '').toLowerCase()}_${(inst.symbol || '').toLowerCase()}`,
          inst
        ])
      );
      
      // Merge new institutions with existing ones
      institutions.forEach(newInst => {
        const institutionKey = `${(newInst.name || '').toLowerCase()}_${(newInst.symbol || '').toLowerCase()}`;
        const existingInst = institutionsMap.get(institutionKey);
        
        if (existingInst) {
          // If institution exists, merge accounts
          const existingAccounts = new Map(
            existingInst.accounts.map(acc => [
              (acc.name || '').toLowerCase(),
              acc
            ])
          );
          
          newInst.accounts.forEach(newAcc => {
            const accountKey = (newAcc.name || '').toLowerCase();
            const existingAcc = existingAccounts.get(accountKey);
            
            if (existingAcc) {
              // For existing accounts, just add the new transactions
              existingAccounts.set(accountKey, {
                ...existingAcc,
                transactions: [
                  ...existingAcc.transactions,
                  ...newAcc.transactions.filter(newTrans => 
                    !existingAcc.transactions.some(existingTrans => 
                      existingTrans.userTxId === newTrans.userTxId
                    )
                  )
                ]
              });
            } else {
              // Add new account with its transactions
              existingAccounts.set(accountKey, newAcc);
            }
          });
          
          institutionsMap.set(institutionKey, {
            ...existingInst,
            accounts: Array.from(existingAccounts.values()),
          });
        } else {
          // If institution doesn't exist, add it with all its accounts
          institutionsMap.set(institutionKey, newInst);
        }
      });

      return {
        ...prevState,
        account: {
          ...prevState.account,
          manualInstitutions: Array.from(institutionsMap.values()),
        },
      };
    });
  };

  const accountManualInstitutionsDeleteOne = (institutionId: string) => {
    setState((prevState: OnboardingState) => ({
      ...prevState,
      account: {
        ...prevState.account,
        manualInstitutions: (prevState.account.manualInstitutions ?? []).filter(
          (institution: AccountOnboardingManualInstitution) =>
            institution.id !== institutionId,
        ),
      },
    }));
  };

  const accountManualInstitutionsLinkAccount = (
    accountId: string,
    budgetFinAccountId: string,
  ) => {
    setState((prevState: OnboardingState) => ({
      ...prevState,
      account: {
        ...prevState.account,
        manualInstitutions: (prevState.account.manualInstitutions ?? []).map(
          (inst) => ({
            ...inst,
            accounts: inst.accounts.map((acc) => ({
              ...acc,
              budgetFinAccountId:
                acc.id === accountId
                  ? budgetFinAccountId
                  : acc.budgetFinAccountId,
            })),
          }),
        ),
      },
    }));
  };

  const accountManualInstitutionsUnlinkAccount = (accountId: string) => {
    setState((prevState: OnboardingState) => ({
      ...prevState,
      account: {
        ...prevState.account,
        manualInstitutions: (prevState.account.manualInstitutions ?? []).map(
          (inst) => ({
            ...inst,
            accounts: inst.accounts.map((acc) => ({
              ...acc,
              budgetFinAccountId:
                acc.id === accountId ? undefined : acc.budgetFinAccountId,
            })),
          }),
        ),
      },
    }));
  };

  const accountManualTransactionUpdate = (
    transactionId: string,
    data: {
      date: string;
      amount: string;
      svend_category_id: string;
      manual_account_id: string;
      user_tx_id: string;
      merchant_name?: string;
      tx_status?: 'pending' | 'posted';
    },
  ) => {
    const transactionsState = (state.account.manualInstitutions ?? []).flatMap(
      (inst) => inst.accounts.flatMap((acc) => acc.transactions),
    );

    const transaction = transactionsState.find((t) => t.id === transactionId);

    if (!transaction)
      throw new Error('[Onboarding State] Transaction not found');

    if (transaction.manualAccountId !== data.manual_account_id) {
      setState((prev) => ({
        ...prev,
        account: {
          ...prev.account,
          manualInstitutions: (prev.account.manualInstitutions ?? []).map(
            (inst) => ({
              ...inst,
              accounts: inst.accounts.map((acc) => ({
                ...acc,
                transactions:
                  acc.id === data.manual_account_id
                    ? [
                        ...acc.transactions,
                        {
                          ...transaction,
                          date: data.date,
                          amount: parseFloat(data.amount),
                          svendCategoryId: data.svend_category_id,
                          manualAccountId: data.manual_account_id,
                          userTxId: data.user_tx_id,
                          merchantName: data.merchant_name || '',
                          status: (data.tx_status || 'posted').toLowerCase() as 'pending' | 'posted',
                          isoCurrencyCode: 'USD',
                        },
                      ]
                    : acc.transactions.filter(
                        (trans) => trans.id !== transactionId,
                      ),
              })),
            }),
          ),
        },
      }));
    } else {
      setState((prev) => ({
        ...prev,
        account: {
          ...prev.account,
          manualInstitutions: (prev.account.manualInstitutions ?? []).map(
            (inst) => ({
              ...inst,
              accounts: inst.accounts.map((acc) => ({
                ...acc,
                transactions: acc.transactions.map((trans) =>
                  trans.id === transactionId
                    ? {
                        ...trans,
                        date: data.date,
                        amount: parseFloat(data.amount),
                        svendCategoryId: data.svend_category_id,
                        manualAccountId: data.manual_account_id,
                        userTxId: data.user_tx_id,
                        merchantName: data.merchant_name || '',
                        status: (data.tx_status || 'posted').toLowerCase() as 'pending' | 'posted',
                        isoCurrencyCode: 'USD',
                      }
                    : trans,
                ),
              })),
            }),
          ),
        },
      }));
    }
  };

  const accountManualTransactionDeleteOne = (transactionId: string) => {
    setState((prev) => ({
      ...prev,
      account: {
        ...prev.account,
        manualInstitutions: (prev.account.manualInstitutions ?? []).map(
          (inst) => ({
            ...inst,
            accounts: inst.accounts.map((acc) => ({
              ...acc,
              transactions: acc.transactions.filter(
                (trans) => trans.id !== transactionId,
              ),
            })),
          }),
        ),
      },
    }));
  };

  const accountManualAccountDeleteOne = (accountId: string) => {
    setState((prev) => ({
      ...prev,
      account: {
        ...prev.account,
        manualInstitutions: (prev.account.manualInstitutions ?? []).map(
          (inst) => ({
            ...inst,
            accounts: inst.accounts.filter((acc) => acc.id !== accountId),
          }),
        ),
      },
    }));
  };

  const accountManualAccountAddOne = (
    institutionId: string,
    account: AccountOnboardingManualInstitutionAccount,
  ) => {
    setState((prev) => ({
      ...prev,
      account: {
        ...prev.account,
        manualInstitutions: (prev.account.manualInstitutions ?? []).map(
          (inst) =>
            inst.id === institutionId
              ? { ...inst, accounts: [...(inst.accounts ?? []), account] }
              : inst,
        ),
      },
    }));
  };

  const accountManualTransactionCreateOne = (
    accountId: string,
    data: FinAccountTransaction,
  ) => {
    setState((prev) => ({
      ...prev,
      account: {
        ...prev.account,
        manualInstitutions: (prev.account.manualInstitutions ?? []).map((inst) => ({
          ...inst,
          accounts: inst.accounts.map((acc) =>
            acc.id === accountId
              ? {
                  ...acc,
                  transactions: [
                    ...acc.transactions,
                    {
                      id: data.id,
                      date: data.date,
                      amount: parseFloat(data.amount.toString()),
                      svendCategoryId: data.svendCategoryId,
                      manualAccountId: data.manualAccountId,
                      userTxId: data.userTxId,
                      merchantName: data.merchantName || '',
                      status: (data.status || 'posted').toLowerCase() as 'pending' | 'posted',
                      isoCurrencyCode: 'USD',
                    },
                  ],
                }
              : acc
          ),
        })),
      },
    }));
  };

  const accountTransactionsPanelSetSelectedAccount = (accountId: string) => {
    setState((prev) => ({
      ...prev,
      account: {
        ...prev.account,
        transactions: {
          ...prev.account.transactions,
          transactionsPanel: { selectedAccount: accountId },
        },
      },
    }));
  };

  const accountTransactionsSideMenuSetSelectedTransaction = (
    transactionId: string | undefined,
  ) => {
    setState((prev) => ({
      ...prev,
      account: {
        ...prev.account,
        transactions: {
          ...prev.account.transactions,
          sideMenu: { selectedTransaction: transactionId },
        },
      },
    }));
  };

  const accountManualInstitutionsUpdateOne = (
    institutionId: string,
    data: { name: string; symbol: string },
  ) => {
    setState((prev) => ({
      ...prev,
      account: {
        ...prev.account,
        manualInstitutions: (prev.account.manualInstitutions ?? []).map(
          (inst) =>
            inst.id === institutionId
              ? {
                  ...inst,
                  ...data,
                }
              : inst,
        ),
      },
    }));
  };

  const accountManualAccountUpdateOne = (
    accountId: string,
    institutionId: string,
    data: { name: string; type: string; mask: string; balanceCurrent: number },
  ) => {
    setState((prev) => ({
      ...prev,
      account: {
        ...prev.account,
        manualInstitutions: (prev.account.manualInstitutions ?? []).map(
          (inst) => {
            if (inst.id === institutionId) {
              return {
                ...inst,
                accounts: inst.accounts.map((acc) =>
                  acc.id === accountId 
                    ? { 
                        ...acc, 
                        ...data,
                        balanceCurrent: data.balanceCurrent 
                      } 
                    : acc,
                ),
              };
            }
            return inst;
          },
        ),
      },
    }));
  };

  const accountSetStepContext = (newContextKey: AccountOnboardingStepContextKey) => {
    setState((prevState: OnboardingState) => {
      const currentStepIdx = accountOnboardingSteps.findIndex(
        (step: { contextKeys: AccountOnboardingStepContextKey[] }) =>
          step.contextKeys.includes(
            prevState.account.contextKey as AccountOnboardingStepContextKey,
          ),
      );

      // Verify the new context key belongs to the current step
      const isValidContextKey = accountOnboardingSteps[currentStepIdx]?.contextKeys.includes(newContextKey);
      
      if (!isValidContextKey) {
        console.error('Invalid context key for current step:', newContextKey);
        return prevState;
      }

      return {
        ...prevState,
        account: {
          ...prevState.account,
          contextKey: newContextKey,
        },
      };
    });
  };

  const accountBudgetSetLinkedFinAccounts = (linkedFinAccounts: FinAccount[]) => {
    setState((prevState: OnboardingState) => {
      if (!prevState.account.budget) {
        console.warn('Cannot update linkedFinAccounts: budget is not initialized');
        return prevState;
      }

      return {
        ...prevState,
        account: {
          ...prevState.account,
          budget: {
            ...prevState.account.budget,
            linkedFinAccounts
          }
        }
      };
    });
  };

  return (
    <OnboardingContext.Provider
      value={{
        state,
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
        accountManualInstitutionsAddOne,
        accountManualInstitutionsAddMany,
        accountManualInstitutionsDeleteOne,
        accountManualInstitutionsLinkAccount,
        accountManualInstitutionsUnlinkAccount,
        accountManualTransactionUpdate,
        accountManualTransactionDeleteOne,
        accountManualAccountDeleteOne,
        accountManualAccountAddOne,
        accountManualTransactionCreateOne,
        accountTransactionsPanelSetSelectedAccount,
        accountTransactionsSideMenuSetSelectedTransaction,
        accountManualInstitutionsUpdateOne,
        accountManualAccountUpdateOne,
        accountSetStepContext,
        accountBudgetSetLinkedFinAccounts,
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
