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
  BudgetFinAccountTransaction,
  BudgetGoal,
  BudgetSpendingRecommendations,
  BudgetSpendingTrackingsByMonth,
} from '../lib/model/budget.types';
import { FinAccount, FinAccountTransaction, ProfileData } from '../lib/model/fin.types';
import {
  BudgetOnboardingManualInstitution,
  BudgetOnboardingManualInstitutionAccount,
  BudgetOnboardingPlaidConnectionItem,
  BudgetOnboardingPlaidItemAccount,
  BudgetOnboardingState,
  BudgetOnboardingStepContextKey,
  budgetOnboardingStepContextKeys,
  budgetOnboardingSteps,
  OnboardingState,
} from '../lib/model/budget.onboarding.types';

import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';


export type BudgetOnboardingContextType = {
  state: OnboardingState;
  budgetSlug: string;
  accountNextStep: () => void;
  accountPrevStep: () => void;
  accountPlaidConnItemAddOne: (
    plaidConnectionItem: BudgetOnboardingPlaidConnectionItem,
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
    account: BudgetOnboardingManualInstitutionAccount,
  ) => void;
  accountManualAccountUpdateOne: (
    accountId: string,
    institutionId: string,
    data: { name: string; type: string; mask: string; balanceCurrent: number },
  ) => void;
  accountManualInstitutionsAddOne: (
    institution: BudgetOnboardingManualInstitution,
  ) => void;
  accountManualInstitutionsAddMany: (
    institutions: BudgetOnboardingManualInstitution[],
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
  accountBudgetGoalsUpsertOne: (budgetGoal: BudgetGoal) => void;
  accountChangeStepContextKey: (
    contextKey: BudgetOnboardingStepContextKey,
  ) => void;
  accountTransactionsPanelSetSelectedAccount: (accountId: string) => void;
  accountTransactionsSideMenuSetSelectedTransaction: (
    transactionId: string | undefined,
  ) => void;
  accountSetStepContext: (newContextKey: BudgetOnboardingStepContextKey) => void;
  accountBudgetSetLinkedFinAccounts: (linkedFinAccounts: FinAccount[]) => void;
  accountSetPlaidItemTransactions: (transactions: BudgetFinAccountTransaction[]) => void;
};

export const BudgetOnboardingContext = createContext<
  BudgetOnboardingContextType | undefined
>(undefined);

export const useBudgetOnboardingContext = () => {
  const context = useContext(BudgetOnboardingContext);
  if (context === undefined) {
    throw new Error(
      'useBudgetOnboardingContext must be used within a BudgetOnboardingContextProvider',
    );
  }
  return context;
};

export function BudgetOnboardingContextProvider({
  children,
  budgetSlug,
}: {
  children: React.ReactNode;
  budgetSlug: string;
}) {
  console.log('BudgetOnboardingContextProvider rendering with budgetSlug:', budgetSlug);

  const [state, setState] = useState<OnboardingState>({
    budget: {
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
        ruleOrder: [],
        name: '',
      },
      userId: undefined,
      svendCategoryGroups: {} as BudgetCategoryGroups,
    }
  });

  const fetchBudgetOnboardingState = useCallback(async () => {
    console.log('fetchBudgetOnboardingState called');
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      console.log('User found:', user.id);
      const response = await fetch(`/api/onboarding/budget/${budgetSlug}/state`);
      console.log('API response status:', response.status);
      if (!response.ok) {
        const error = await response.json();
        console.error('Error fetching budget onboarding state:', error);
        return null;
      }
      const data = await response.json();
      console.log('API response data:', data);
      return data.budgetOnboardingState;
    }
    return null;
  }, [budgetSlug]);

  // Start fetching data immediately on the client side
  useEffect(() => {
    console.log('BudgetOnboardingContextProvider useEffect running');
    fetchBudgetOnboardingState().then((budgetOnboardingState) => {
      console.log('Received budgetOnboardingState:', budgetOnboardingState);
      if (budgetOnboardingState) {
        setState((prevState: OnboardingState) => ({
          ...prevState,
          budget: budgetOnboardingState,
        }));
      }
    });
  }, [fetchBudgetOnboardingState]);

  const accountNextStep = async () => {
    setState((prevState: OnboardingState) => {
      const prevStepIdx = budgetOnboardingSteps.findIndex(
        (step: { contextKeys: BudgetOnboardingStepContextKey[] }) =>
          step.contextKeys.includes(
            prevState.budget.contextKey as BudgetOnboardingStepContextKey,
          ),
      );
      const nextStepIndex = Math.min(
        prevStepIdx + 1,
        budgetOnboardingStepContextKeys.length - 1,
      );
      let newStateBudget = {
        ...prevState.budget,
        currentStepIdx: nextStepIndex,
        contextKey: budgetOnboardingSteps[nextStepIndex]?.contextKeys[0],
      };

      if (newStateBudget.contextKey == 'manual') {
        accountNextStep();
        return prevState;
      }

      return {
        ...prevState,
        budget: newStateBudget,
      };
    });
  };

  const accountPrevStep = () => {
    setState((prevState: OnboardingState) => {
      const currentIndex = budgetOnboardingStepContextKeys.indexOf(
        prevState.budget.contextKey as BudgetOnboardingStepContextKey,
      );
      let currentStep = budgetOnboardingSteps.find(
        (step: { contextKeys: BudgetOnboardingStepContextKey[] }) =>
          step.contextKeys.includes(
            prevState.budget.contextKey as BudgetOnboardingStepContextKey,
          ),
      );
      let prevIndex = currentIndex - 1;
      while (
        prevIndex < budgetOnboardingStepContextKeys.length &&
        !currentStep?.contextKeys.includes(
          budgetOnboardingStepContextKeys[
            prevIndex
          ] as BudgetOnboardingStepContextKey,
        )
      ) {
        prevIndex--;
      }
      prevIndex = Math.max(prevIndex + 1, 0);
      let newStateBudget = {
        ...prevState.budget,
        currentStepIdx: prevIndex,
        contextKey: budgetOnboardingStepContextKeys[prevIndex],
      };
      return {
        ...prevState,
        budget: newStateBudget,
      };
    });
  };

  const accountPlaidConnItemAddOne = (
    plaidConnectionItem: BudgetOnboardingPlaidConnectionItem,
  ) => {
    setState((prevState: OnboardingState) => {
      let newStateBudget = {
        ...prevState.budget,
        plaidConnectionItems: [
          ...(prevState.budget.plaidConnectionItems || []),
          plaidConnectionItem,
        ],
      };
      return {
        ...prevState,
        budget: newStateBudget,
      };
    });
  };

  const accountPlaidConnItemRemoveOne = (svendItemId: string) => {
    setState((prevState: OnboardingState) => ({
      ...prevState,
      budget: {
        ...prevState.budget,
        plaidConnectionItems: (
          prevState.budget.plaidConnectionItems ?? []
        ).filter(
          (item: BudgetOnboardingPlaidConnectionItem) =>
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
    console.log('Linking account with:', { svendItemId, svendAccountId, budgetFinAccountId });
    console.log('Current state:', state);
    
    setState((prevState: OnboardingState) => {
      const newState = {
        ...prevState,
        budget: {
          ...prevState.budget,
          plaidConnectionItems: (
            prevState.budget.plaidConnectionItems ?? []
          ).map((item: BudgetOnboardingPlaidConnectionItem) =>
            item.svendItemId === svendItemId
              ? {
                  ...item,
                  itemAccounts: item.itemAccounts.map(
                    (account: BudgetOnboardingPlaidItemAccount) =>
                      account.svendAccountId === svendAccountId
                        ? { ...account, budgetFinAccountId }
                        : account,
                  ),
                }
              : item,
          ),
        },
      };
      console.log('New state:', newState);
      return newState;
    });
  };

  const accountPlaidItemAccountUnlinkOne = (
    svendItemId: string,
    svendAccountId: string,
  ) => {
    setState((prevState: OnboardingState) => ({
      ...prevState,
      budget: {
        ...prevState.budget,
        plaidConnectionItems: (
          prevState.budget.plaidConnectionItems ?? []
        ).map((item: BudgetOnboardingPlaidConnectionItem) =>
          item.svendItemId === svendItemId
            ? {
                ...item,
                itemAccounts: item.itemAccounts.map(
                  (account: BudgetOnboardingPlaidItemAccount) =>
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
      budget: {
        ...prevState.budget,
        profileData,
      },
    }));
  };

  const accountBudgetUpdate = (budget: Budget) => {
    setState((prevState: OnboardingState) => {
      const newState = {
        ...prevState,
        budget: {
          ...prevState.budget,
          budget,
        },
      };

      return newState;
    });
  };

  const accountBudgetGoalsUpsertOne = (budgetGoal: BudgetGoal) => {
    setState((prevState: OnboardingState) => {
      const existingGoals = prevState.budget.budget?.goals || [];
      
      console.log("Debug goal update:", {
        existingGoals,
        newGoal: budgetGoal,
        hasSubType: 'subType' in budgetGoal
      });
      
      const existingGoalIndex = existingGoals.findIndex(goal => goal.id === budgetGoal.id);

      if (existingGoalIndex >= 0) {
        // If it exists, update it
        const updatedGoals = [...existingGoals];
        updatedGoals[existingGoalIndex] = {
          ...updatedGoals[existingGoalIndex],  // Keep existing properties
          ...budgetGoal,  // Override with new values
        };
        return {
          ...prevState,
          budget: {
            ...prevState.budget,
            budget: {
              ...prevState.budget.budget,
              goals: updatedGoals,
            },
          },
        };
      }

      // If it's a new goal, add it
      return {
        ...prevState,
        budget: {
          ...prevState.budget,
          budget: {
            ...prevState.budget.budget,
            goals: [...existingGoals, budgetGoal],
          },
        },
      };
    });
  };

  const accountChangeStepContextKey = (
    contextKey: BudgetOnboardingStepContextKey,
  ): boolean => {
    let success = false;

    setState((prevState: OnboardingState) => {
      const currentStep = budgetOnboardingSteps.find(
        (step: { contextKeys: BudgetOnboardingStepContextKey[] }) =>
          step.contextKeys.includes(
            prevState.budget.contextKey as BudgetOnboardingStepContextKey,
          ),
      );
      if (currentStep && currentStep.contextKeys.includes(contextKey)) {
        success = true;
        return {
          ...prevState,
          budget: {
            ...prevState.budget,
            contextKey: contextKey,
          },
        };
      }
      return prevState;
    });
    return success;
  };

  const accountManualInstitutionsAddOne = (
    institution: BudgetOnboardingManualInstitution,
  ) => {
    setState((prevState: OnboardingState) => ({
      ...prevState,
      budget: {
        ...prevState.budget,
        manualInstitutions: [
          ...(prevState.budget.manualInstitutions || []),
          institution,
        ],
      },
    }));
  };

  const accountManualInstitutionsAddMany = (
    institutions: BudgetOnboardingManualInstitution[],
  ) => {
    setState((prevState: OnboardingState) => {
      const existingInstitutions = prevState.budget.manualInstitutions ?? [];
      
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
        budget: {
          ...prevState.budget,
          manualInstitutions: Array.from(institutionsMap.values()),
        },
      };
    });
  };

  const accountManualInstitutionsDeleteOne = (institutionId: string) => {
    setState((prevState: OnboardingState) => ({
      ...prevState,
      budget: {
        ...prevState.budget,
        manualInstitutions: (prevState.budget.manualInstitutions ?? []).filter(
          (institution: BudgetOnboardingManualInstitution) =>
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
      budget: {
        ...prevState.budget,
        manualInstitutions: (prevState.budget.manualInstitutions ?? []).map(
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
      budget: {
        ...prevState.budget,
        manualInstitutions: (prevState.budget.manualInstitutions ?? []).map(
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
    const transactionsState = (state.budget.manualInstitutions ?? []).flatMap(
      (inst) => inst.accounts.flatMap((acc) => acc.transactions),
    );

    const transaction = transactionsState.find((t) => t.id === transactionId);

    if (!transaction)
      throw new Error('[Onboarding State] Transaction not found');

    if (transaction.manualAccountId !== data.manual_account_id) {
      setState((prev) => ({
        ...prev,
        budget: {
          ...prev.budget,
          manualInstitutions: (prev.budget.manualInstitutions ?? []).map(
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
        budget: {
          ...prev.budget,
          manualInstitutions: (prev.budget.manualInstitutions ?? []).map(
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
      budget: {
        ...prev.budget,
        manualInstitutions: (prev.budget.manualInstitutions ?? []).map(
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
      budget: {
        ...prev.budget,
        manualInstitutions: (prev.budget.manualInstitutions ?? []).map(
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
    account: BudgetOnboardingManualInstitutionAccount,
  ) => {
    setState((prev) => ({
      ...prev,
      budget: {
        ...prev.budget,
        manualInstitutions: (prev.budget.manualInstitutions ?? []).map(
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
      budget: {
        ...prev.budget,
        manualInstitutions: (prev.budget.manualInstitutions ?? []).map((inst) => ({
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
      budget: {
        ...prev.budget,
        transactions: {
          ...prev.budget.transactions,
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
      budget: {
        ...prev.budget,
        transactions: {
          ...prev.budget.transactions,
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
      budget: {
        ...prev.budget,
        manualInstitutions: (prev.budget.manualInstitutions ?? []).map(
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
      budget: {
        ...prev.budget,
        manualInstitutions: (prev.budget.manualInstitutions ?? []).map(
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

  const accountSetStepContext = (newContextKey: BudgetOnboardingStepContextKey) => {
    setState((prevState: OnboardingState) => {
      const currentStepIdx = budgetOnboardingSteps.findIndex(
        (step: { contextKeys: BudgetOnboardingStepContextKey[] }) =>
          step.contextKeys.includes(
            prevState.budget.contextKey as BudgetOnboardingStepContextKey,
          ),
      );

      // Verify the new context key belongs to the current step
      const isValidContextKey = budgetOnboardingSteps[currentStepIdx]?.contextKeys.includes(newContextKey);
      
      if (!isValidContextKey) {
        console.error('Invalid context key for current step:', newContextKey);
        return prevState;
      }

      const newState = {
        ...prevState,
        budget: {
          ...prevState.budget,
          contextKey: newContextKey,
        },
      };

      return newState;
    });
  };

  const accountBudgetSetLinkedFinAccounts = (linkedFinAccounts: FinAccount[]) => {
    setState((prevState: OnboardingState) => {
      if (!prevState.budget.budget) {
        console.warn('Cannot update linkedFinAccounts: budget is not initialized');
        return prevState;
      }

      return {
        ...prevState,
        budget: {
          ...prevState.budget,
          budget: {
            ...prevState.budget.budget,
            linkedFinAccounts
          }
        }
      };
    });
  };

  const accountSetPlaidItemTransactions = (transactions: BudgetFinAccountTransaction[]) => {
    console.log('Setting Plaid transactions in budget context:', transactions);
    setState((prev) => {
      const newState = {
        ...prev,
        budget: {
          ...prev.budget,
          plaidConnectionItems: (prev.budget.plaidConnectionItems ?? []).map((item) => {
            const newItem = {
              ...item,
              itemAccounts: item.itemAccounts.map((acc) => {
                // Find transactions for this account
                const accountTransactions = transactions.filter((tx) => 
                  tx.budgetFinAccountId === acc.budgetFinAccountId
                );
                
                // Merge with existing transactions, avoiding duplicates
                const existingTransactions = acc.transactions || [];
                const mergedTransactions = [...existingTransactions];
                
                accountTransactions.forEach(newTx => {
                  const existingIndex = mergedTransactions.findIndex(
                    tx => tx.transaction.plaidTxId === newTx.transaction.plaidTxId
                  );
                  if (existingIndex === -1) {
                    mergedTransactions.push(newTx);
                  }
                });

                return {
                  ...acc,
                  transactions: mergedTransactions
                };
              })
            };
            return newItem;
          })
        }
      };
      console.log('Updated budget state with transactions:', newState);
      return newState;
    });
  };

  return (
    <BudgetOnboardingContext.Provider
      value={{
        state,
        budgetSlug,
        accountNextStep,
        accountPrevStep,
        accountPlaidConnItemAddOne,
        accountPlaidConnItemRemoveOne,
        accountPlaidItemAccountLinkOne,
        accountPlaidItemAccountUnlinkOne,
        accountProfileDataUpdate,
        accountBudgetUpdate,
        accountBudgetGoalsUpsertOne: accountBudgetGoalsUpsertOne,
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
        accountSetPlaidItemTransactions,
      }}
    >
      {children}
    </BudgetOnboardingContext.Provider>
  );
}

// export function useOnboarding() {
//   const context = useContext(BudgetOnboardingContext);
//   if (context === undefined) {
//     throw new Error('useOnboarding must be used within an OnboardingProvider');
//   }
//   return context;
// }
