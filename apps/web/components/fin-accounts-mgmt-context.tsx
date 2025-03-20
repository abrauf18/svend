'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { Budget } from '../lib/model/budget.types';
import { FinAccount, FinAccountTransaction, ProfileData } from '../lib/model/fin.types';
import {
  FinAccountsMgmtState,
  FinAccountsMgmtPlaidConnectionItem,
  FinAccountsMgmtManualInstitution,
  FinAccountsMgmtManualInstitutionAccount,
  FinAccountsMgmtPlaidItemAccount
} from '../lib/model/fin-accounts-mgmt.types';

export type FinAccountsMgmtContextType = {
  state: FinAccountsMgmtState;
  accountPlaidConnItemAddOne: (
    plaidConnectionItem: FinAccountsMgmtPlaidConnectionItem,
  ) => void;
  accountPlaidConnItemRemoveOne: (svendItemId: string) => void;
  accountPlaidItemAccountLinkOne: (
    svendItemId: string,
    svendAccountId: string,
    budgetId: string,
    budgetFinAccountId: string,
  ) => void;
  accountPlaidItemAccountUnlinkOne: (
    svendItemId: string,
    svendAccountId: string,
  ) => void;
  accountManualAccountDeleteOne: (accountId: string) => void;
  accountManualAccountAddOne: (
    institutionId: string,
    account: FinAccountsMgmtManualInstitutionAccount,
  ) => void;
  accountManualAccountUpdateOne: (
    accountId: string,
    institutionId: string,
    data: { name: string; type: string; mask: string; balanceCurrent: number },
  ) => void;
  accountManualInstitutionsAddOne: (
    institution: FinAccountsMgmtManualInstitution,
  ) => void;
  accountManualInstitutionsAddMany: (
    institutions: FinAccountsMgmtManualInstitution[],
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
  accountTransactionsPanelSetSelectedAccount: (accountId: string) => void;
  accountTransactionsSideMenuSetSelectedTransaction: (
    transactionId: string | undefined,
  ) => void;
  accountBudgetSetLinkedFinAccounts: (linkedFinAccounts: FinAccount[]) => void;
};

export const FinAccountsMgmtContext = createContext<
  FinAccountsMgmtContextType | undefined
>(undefined);

export const useFinAccountsMgmtContext = () => {
  const context = useContext(FinAccountsMgmtContext);
  if (context === undefined) {
    throw new Error(
      'useFinAccountsMgmtContext must be used within a FinAccountsMgmtProvider',
    );
  }
  return context;
};

const defaultState: FinAccountsMgmtState = {
  account: {
    budgets: [],
    plaidConnectionItems: [],
    manualInstitutions: []
  }
};

interface FinAccountsMgmtProviderProps {
  children: React.ReactNode;
  initialState?: FinAccountsMgmtState;
}

export function FinAccountsMgmtProvider({ children, initialState }: FinAccountsMgmtProviderProps) {
  return (
    <FinAccountsMgmtContextProvider initialState={initialState}>
      {children}
    </FinAccountsMgmtContextProvider>
  );
}

export function FinAccountsMgmtContextProvider({
  children,
  initialState,
}: {
  children: React.ReactNode;
  initialState?: FinAccountsMgmtState;
}) {
  const [state, setState] = useState<FinAccountsMgmtState>(() => 
    initialState ?? defaultState
  );
  const [isLoading, setIsLoading] = useState(!initialState);

  useEffect(() => {
    console.log('state fin accounts mgmt context', state);
  }, [state]);

  const fetchFinAccountsMgmtInitialState = useCallback(async () => {
    if (initialState) return null; // No fetch if we have initial state
    
    try {
      const response = await fetch('/api/fin-account-mgmt/state');

      if (!response.ok) {
        console.error('Error response:', await response.text());
        return null;
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching state:', error);
      return null;
    }
  }, [initialState]);

  useEffect(() => {
    if (!initialState) {
      void fetchFinAccountsMgmtInitialState().then((data) => {
        if (data) {
          setState(data);
        }
        setIsLoading(false);
      });
    }
  }, [fetchFinAccountsMgmtInitialState, initialState]);

  if (isLoading) {
    return null; // O un componente de loading
  }

  const accountPlaidConnItemAddOne = (
    plaidConnectionItem: FinAccountsMgmtPlaidConnectionItem,
  ) => {
    setState((prevState: FinAccountsMgmtState) => {
      // Ensure each account has budgetFinAccountIds initialized
      const itemWithInitializedAccounts = {
        ...plaidConnectionItem,
        itemAccounts: plaidConnectionItem.itemAccounts.map(account => ({
          ...account,
          budgetFinAccountIds: account.budgetFinAccountIds ?? []
        }))
      };

      const newStateAccount = {
        ...prevState.account,
        plaidConnectionItems: [
          ...(prevState.account.plaidConnectionItems ?? []),
          itemWithInitializedAccounts,
        ],
      };
      return {
        ...prevState,
        account: newStateAccount,
      };
    });
  };

  const accountPlaidConnItemRemoveOne = (svendItemId: string) => {
    setState((prevState: FinAccountsMgmtState): FinAccountsMgmtState => {
        const itemToRemove = prevState.account.plaidConnectionItems?.find(
            item => item.svendItemId === svendItemId
        );

        const accountIdsToRemove = itemToRemove?.itemAccounts?.map(
            account => account.svendAccountId
        ) ?? [];

        const filteredPlaidItems = (prevState.account.plaidConnectionItems ?? [])
            .filter(item => item.svendItemId !== svendItemId);

        const updatedBudgets = prevState.account.budgets?.map(budget => ({
            ...budget,
            linkedFinAccounts: budget.linkedFinAccounts.filter(
                account => account.source === 'svend' || !accountIdsToRemove.includes(account.id)
            )
        }));

        return {
            account: {
                ...prevState.account,
                plaidConnectionItems: filteredPlaidItems,
                budgets: updatedBudgets
            }
        };
    });
  };

  const accountPlaidItemAccountLinkOne = (
    svendItemId: string,
    svendAccountId: string,
    budgetId: string,
    budgetFinAccountId: string,
  ) => {
    setState((prevState: FinAccountsMgmtState): FinAccountsMgmtState => {
      const plaidItem = prevState.account.plaidConnectionItems?.find(
        item => item.svendItemId === svendItemId
      );
      const plaidAccount = plaidItem?.itemAccounts.find(
        account => account.svendAccountId === svendAccountId
      );

      if (!plaidAccount) return prevState;

      const linkedFinAccount: FinAccount = {
        id: svendAccountId,
        source: 'plaid',
        type: plaidAccount.accountType as 'depository' | 'credit' | 'loan' | 'investment' | 'other',
        institutionName: plaidItem?.institutionName ?? '',
        budgetFinAccountId: budgetFinAccountId,
        name: plaidAccount.accountName,
        mask: plaidAccount.mask,
        officialName: plaidAccount.accountName,
        balance: plaidAccount.balanceCurrent,
        balanceCurrent: plaidAccount.balanceCurrent
      };

      const updatedPlaidItems = (prevState.account.plaidConnectionItems ?? []).map(item => {
        if (item.svendItemId === svendItemId) {
          const updatedItem: FinAccountsMgmtPlaidConnectionItem = {
            ...item,
            itemAccounts: item.itemAccounts.map(account => 
              account.svendAccountId === svendAccountId
                ? { ...account, budgetFinAccountIds: [...(account.budgetFinAccountIds ?? []), budgetFinAccountId] }
                : account
            )
          };
          return updatedItem;
        }
        return item;
      });

      // Update only the specific budget
      const updatedBudgets = prevState.account.budgets?.map(budget => {
        if (budget.id === budgetId) {  // Compare against budgetId instead of budgetFinAccountId
          const alreadyLinked = budget.linkedFinAccounts?.some(acc => acc.id === svendAccountId);
          if (!alreadyLinked) {
            return {
              ...budget,
              linkedFinAccounts: [...(budget.linkedFinAccounts ?? []), linkedFinAccount]
            };
          }
        }
        return budget;
      });

      return {
        account: {
          ...prevState.account,
          budgets: updatedBudgets,
          plaidConnectionItems: updatedPlaidItems
        }
      };
    });
  };

  const accountPlaidItemAccountUnlinkOne = (
    svendItemId: string,
    svendAccountId: string,
  ) => {
    setState((prevState: FinAccountsMgmtState) => ({
      ...prevState,
      account: {
        ...prevState.account,
        budgets: prevState.account.budgets?.map(budget => ({
          ...budget,
          linkedFinAccounts: (budget.linkedFinAccounts ?? []).filter(
            account => account.id !== svendAccountId
          )
        })),
        plaidConnectionItems: (prevState.account.plaidConnectionItems ?? [])
          .map((item) =>
            item.svendItemId === svendItemId
              ? {
                  ...item,
                  itemAccounts: item.itemAccounts.map(
                    (account) =>
                      account.svendAccountId === svendAccountId
                        ? { ...account, budgetFinAccountIds: [] }
                        : account,
                  ),
                }
              : item,
          ),
      },
    }));
  };

  const accountProfileDataUpdate = (profileData: ProfileData) => {
    setState((prevState: FinAccountsMgmtState) => ({
      ...prevState,
      account: {
        ...prevState.account,
        profileData,
      },
    }));
  };

  const accountBudgetUpdate = (budget: Budget) => {
    setState((prevState: FinAccountsMgmtState) => {
      const existingBudgets = prevState.account.budgets ?? [];
      const updatedBudgets = existingBudgets.map(b => 
        b.id === budget.id ? budget : b
      );
      
      if (!existingBudgets.find(b => b.id === budget.id)) {
        updatedBudgets.push(budget);
      }

      return {
        ...prevState,
        account: {
          ...prevState.account,
          budgets: updatedBudgets,
        },
      };
    });
  };

 
  const accountManualInstitutionsAddOne = (
    institution: FinAccountsMgmtManualInstitution,
  ) => {
    setState((prevState: FinAccountsMgmtState) => ({
      ...prevState,
      account: {
        ...prevState.account,
        manualInstitutions: [
          ...(prevState.account.manualInstitutions ?? []),
          institution,
        ],
      },
    }));
  };

  const accountManualInstitutionsAddMany = (
    institutions: FinAccountsMgmtManualInstitution[],
  ) => {
    console.log('accountManualInstitutionsAddMany called with:', institutions);
    
    setState((prevState: FinAccountsMgmtState) => {
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
    setState((prevState: FinAccountsMgmtState) => {
        const institutionToRemove = prevState.account.manualInstitutions?.find(
            inst => inst.id === institutionId
        );

        const accountIdsToRemove = institutionToRemove?.accounts?.map(
            account => account.id
        ) ?? [];

        return {
            ...prevState,
            account: {
                ...prevState.account,
                manualInstitutions: (
                    prevState.account.manualInstitutions ?? []
                ).filter(inst => inst.id !== institutionId),
                budgets: prevState.account.budgets?.map(budget => ({
                    ...budget,
                    linkedFinAccounts: (
                        budget.linkedFinAccounts ?? []
                    ).filter(account => 
                        account.source === 'plaid' || 
                        !accountIdsToRemove.includes(account.id)
                    )
                }))
            }
        };
    });
  };

  const accountManualInstitutionsLinkAccount = (
    accountId: string,
    budgetFinAccountId: string,
  ) => {
    setState((prevState: FinAccountsMgmtState) => {
      // Encontrar la cuenta manual en las instituciones
      const institution = prevState.account.manualInstitutions?.find(
        inst => inst.accounts.some(acc => acc.id === accountId)
      );
      const account = institution?.accounts.find(acc => acc.id === accountId);

      if (!account) return prevState;

      // Crear el objeto linkedFinAccount
      const linkedFinAccount: FinAccount = {
        id: accountId,
        source: 'svend',
        type: account.type as 'depository' | 'credit' | 'loan' | 'investment' | 'other',
        institutionName: institution?.name ?? '',
        budgetFinAccountId,
        name: account.name,
        mask: account.mask,
        officialName: account.name,
        balance: account.balanceCurrent,
        balanceCurrent: account.balanceCurrent
      };

      return {
        ...prevState,
        account: {
          ...prevState.account,
          budgets: prevState.account.budgets?.map(budget => ({
            ...budget,
            linkedFinAccounts: [
              ...(budget.linkedFinAccounts ?? []),
              linkedFinAccount
            ]
          })),
          manualInstitutions: (prevState.account.manualInstitutions ?? []).map(
            (inst) => ({
              ...inst,
              accounts: inst.accounts.map((acc) => ({
                ...acc,
                budgetFinAccountIds:
                  acc.id === accountId
                    ? [budgetFinAccountId]
                    : acc.budgetFinAccountIds,
              })),
            }),
          ),
        },
      };
    });
  };

  const accountManualInstitutionsUnlinkAccount = (accountId: string) => {
    setState((prevState: FinAccountsMgmtState) => ({
      ...prevState,
      account: {
        ...prevState.account,
        budgets: prevState.account.budgets?.map(budget => ({
          ...budget,
          linkedFinAccounts: budget.linkedFinAccounts.filter(
            account => account.id !== accountId
          )
        })),
        manualInstitutions: (prevState.account.manualInstitutions ?? []).map(
          (inst) => ({
            ...inst,
            accounts: inst.accounts.map((acc) => ({
              ...acc,
              budgetFinAccountIds:
                acc.id === accountId ? [] : acc.budgetFinAccountIds,
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
                          merchantName: data.merchant_name ?? '',
                          status: (data.tx_status ?? 'posted').toLowerCase() as 'pending' | 'posted',
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
                        merchantName: data.merchant_name ?? '',
                        status: (data.tx_status ?? 'posted').toLowerCase() as 'pending' | 'posted',
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
    account: FinAccountsMgmtManualInstitutionAccount,
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


  const accountBudgetSetLinkedFinAccounts = (linkedFinAccounts: FinAccount[]) => {
    setState((prevState: FinAccountsMgmtState) => {
      if (!prevState.account.budgets) {
        console.warn('Cannot update linkedFinAccounts: budgets are not initialized');
        return prevState;
      }

      return {
        ...prevState,
        account: {
          ...prevState.account,
          budgets: prevState.account.budgets.map(budget => ({
            ...budget,
            linkedFinAccounts
          })),
        }
      };
    });
  };

  return (
    <FinAccountsMgmtContext.Provider
      value={{
        state,
        accountPlaidConnItemAddOne,
        accountPlaidConnItemRemoveOne,
        accountPlaidItemAccountLinkOne,
        accountPlaidItemAccountUnlinkOne,
        accountProfileDataUpdate,
        accountBudgetUpdate,
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
        accountBudgetSetLinkedFinAccounts,
      }}
    >
      {children}
    </FinAccountsMgmtContext.Provider>
  );
}