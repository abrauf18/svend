import React, { useEffect, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Checkbox } from '@kit/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Trans } from '@kit/ui/trans';
import { useBudgetOnboardingContext } from '~/components/budget-onboarding-context';
import { ProfileData } from '~/lib/model/fin.types';
import { Input } from '@kit/ui/input';
import { OnboardingState } from '~/lib/model/budget.onboarding.types';
import { BudgetOnboardingState } from '~/lib/model/budget.onboarding.types';
const FormSchema = z.object({
  annualIncome: z.string()
    .min(1, 'Annual income is required')
    .transform((val) => {
      const num = parseInt(val.replace(/[^0-9]/g, ''), 10);
      if (isNaN(num)) throw new Error('Must be a valid number');
      return num;
    })
    .refine((val) => val >= 0, 'Must be positive')
    .refine((val) => val <= 100000000, 'Must be less than $100M'),
  savings: z.string()
    .min(1, 'Savings amount is required')
    .transform((val) => {
      const num = parseInt(val.replace(/[^0-9]/g, ''), 10);
      if (isNaN(num)) throw new Error('Must be a valid number');
      return num;
    })
    .refine((val) => val >= 0, 'Must be positive')
    .refine((val) => val <= 100000000, 'Must be less than $100M'),
});

const calculateDefaultIncome = (state: OnboardingState): string => {
  const manualInstitutions = state.budget.manualInstitutions || [];
  const plaidConnections = state.budget.plaidConnectionItems || [];
  const categoryGroups = state.budget.svendCategoryGroups || {};
  
  console.log('Initial state check:', {
    manualInstitutions: manualInstitutions.map(inst => ({
      name: inst.name,
      accounts: inst.accounts.map(acc => ({
        name: acc.name,
        transactionCount: acc.transactions?.length
      }))
    })),
    plaidConnections: plaidConnections.map(conn => ({
      accounts: conn.itemAccounts.map(acc => ({
        name: acc.accountName,
        transactionCount: acc.transactions?.length
      }))
    }))
  });
  
  // Find Income category group
  const incomeGroup = Object.values(categoryGroups).find(group => 
    group.name.toLowerCase() === 'income'
  );
  console.log('Found income group:', incomeGroup);
  
  if (!incomeGroup) return "";
  
  // Calculate date 30 days ago from today
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
  console.log('Looking for transactions since:', thirtyDaysAgo);

  // Get manual transactions
  const manualTransactions = manualInstitutions.flatMap(inst => 
    inst.accounts.flatMap(acc => {
      console.log('Checking manual account:', acc.name, 'with transactions:', acc.transactions?.length);
      const transactions = acc.budgetFinAccountId 
        ? acc.transactions.filter(tx => {
            const isIncome = incomeGroup.categories.some(c => c.id === tx.svendCategoryId);
            const isPosted = tx.status === 'posted';
            const isRecent = new Date(tx.date) >= thirtyDaysAgo;
            console.log('Manual transaction:', {
              amount: tx.amount,
              categoryId: tx.svendCategoryId,
              isIncome,
              isPosted,
              isRecent,
              date: tx.date
            });
            return isIncome && isPosted && isRecent;
          })
        : [];
      return transactions;
    })
  );

  // Get Plaid transactions
  const plaidTransactions = plaidConnections.flatMap(conn => 
    conn.itemAccounts.flatMap(acc => {
      console.log('Checking Plaid account:', acc.accountName, 'with transactions:', acc.transactions?.length);
      const transactions = (acc.transactions || []).filter(tx => {
        const isIncome = tx.categoryGroup?.toLowerCase() === 'income';
        const isPosted = tx.transaction.status === 'posted';
        const isRecent = new Date(tx.transaction.date) >= thirtyDaysAgo;
        console.log('Plaid transaction:', {
          amount: tx.transaction.amount,
          categoryGroup: tx.categoryGroup,
          isIncome,
          isPosted,
          isRecent,
          date: tx.transaction.date
        });
        return isIncome && isPosted && isRecent;
      });
      return transactions;
    })
  );

  console.log('Found manual transactions:', manualTransactions.length);
  console.log('Found Plaid transactions:', plaidTransactions.length);

  // Calculate total
  const annualIncome = Math.round(
    (manualTransactions.reduce((sum, tx) => 
      sum + Math.abs(Number(tx.amount)), 0) +
    plaidTransactions.reduce((sum, tx) => 
      sum + Math.abs(Number(tx.transaction.amount)), 0)) * 12
  );

  console.log('Calculated annual income:', annualIncome);

  return annualIncome <= 0 ? "" : annualIncome.toString();
};

const calculateDefaultSavings = (state: OnboardingState): string => {
  const linkedAccounts = state.budget.budget?.linkedFinAccounts || [];
  
  // Sum balances of all depository accounts
  const totalSavings = linkedAccounts
    .filter(account => {
      const accountType = account.source === 'plaid'
        ? state.budget.plaidConnectionItems
            ?.flatMap(item => item.itemAccounts)
            .find(plaidAcc => plaidAcc.svendAccountId === account.id)
            ?.accountType
        : state.budget.manualInstitutions
            ?.flatMap(inst => inst.accounts)
            .find(manualAcc => manualAcc.id === account.id)
            ?.type;
      
      return accountType === 'depository' || accountType === 'investment';
    })
    .reduce((sum, account) => sum + (account.balance || 0), 0);

  return totalSavings <= 0 ? "" : totalSavings.toString();
};

export function FinancialInformation(props: {
  onValidationChange: (isValid: boolean) => void;
  triggerSubmit: (submitHandler: () => Promise<boolean>) => void;
  initialData: any;
}) {
  const { state, accountProfileDataUpdate, budgetSlug } = useBudgetOnboardingContext();
  const [isLoading, setIsLoading] = useState(true);

  // Initialize form with empty values first
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      annualIncome: 0,
      savings: 0,
    },
    mode: 'onChange',
  });

  const { reset } = form;
  const annualIncomeInputRef = useRef<HTMLInputElement | null>(null);

  // Update form values when state is loaded
  useEffect(() => {
    console.log('State changed:', { 
      hasBudget: !!state.budget,
      initialData: props.initialData,
      isLoading 
    });
    
    if (state.budget) {
      const defaultIncome = calculateDefaultIncome(state);
      const defaultSavings = calculateDefaultSavings(state);
      
      console.log('Calculated values:', { defaultIncome, defaultSavings });
      
      const newValues = {
        annualIncome: props.initialData?.annualIncome?.toString() || defaultIncome || "",
        savings: props.initialData?.savings?.toString() || defaultSavings || "",
      };
      
      console.log('Setting form values:', newValues);
      reset(newValues);
      setIsLoading(false);
    }
  }, [state.budget, props.initialData, reset, isLoading]);

  useEffect(() => {
    if (annualIncomeInputRef.current) {
      annualIncomeInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    props.onValidationChange(form.formState.isValid);
  }, [form.formState.isValid]);

  useEffect(() => {
    props.triggerSubmit(async () => {
      if (form.formState.isValid) {
        try {
          const data = form.getValues();
          await serverSubmit(data);

          accountProfileDataUpdate({
            ...state.budget.profileData,
            annualIncome: data.annualIncome.toString(),
            savings: data.savings.toString(),
          } as ProfileData);

          return true;
        } catch (error) {
          return false;
        }
      }
      return false;
    });
  }, [form]);

  const serverSubmit = async (
    data: z.infer<typeof FormSchema>,
  ): Promise<boolean> => {
    try {
      const response = await fetch(`/api/onboarding/budget/${budgetSlug}/profile/fin`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          annualIncome: data.annualIncome,
          savings: data.savings,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          'Error updating financial profile - fin info: ' + errorData.error,
        );
      }
    } catch (error: any) {
      console.error(error);
      throw error;
    }

    return true;
  };

  const loanAccounts = state.budget.budget?.linkedFinAccounts.filter(account => {
    const accountType = account.source === 'plaid'
      ? state.budget.plaidConnectionItems
          ?.flatMap(item => item.itemAccounts)
          .find(plaidAcc => plaidAcc.svendAccountId === account.id)
          ?.accountType
      : state.budget.manualInstitutions
          ?.flatMap(inst => inst.accounts)
          .find(manualAcc => manualAcc.id === account.id)
          ?.type;
    
    return accountType === 'loan' || accountType === 'credit';
  }) || [];

  return (
    <>
      <h3 className="text-xl font-semibold">
        <Trans i18nKey={'onboarding:financialInformationTitle'} />
      </h3>
      <Form {...form}>
        <form className={'flex flex-col space-y-4'}>
          <div className={'flex flex-col space-y-4'}>
            <div className={'w-2/5'}>
              <FormField
                control={form.control}
                name="annualIncome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'onboarding:financialInformationAnnualIncomeLabel'} />
                    </FormLabel>
                    <FormControl>
                      <div className="relative w-48">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                          $
                        </span>
                        <Input 
                          {...field}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className="pl-8"
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '');
                            field.onChange(value);
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className={'w-2/5'}>
              <FormField
                control={form.control}
                name="savings"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'onboarding:savingsLevel.label'} />
                    </FormLabel>
                    <FormControl>
                      <div className="relative w-48">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                          $
                        </span>
                        <Input 
                          {...field}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className="pl-8"
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '');
                            field.onChange(value);
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Loan Accounts List */}
            <div className={'w-3/5'}>
              <FormLabel className="text-base block mb-2">
                <Trans i18nKey={'onboarding:debtAccounts.title'} />
              </FormLabel>
              {loanAccounts.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  <Trans i18nKey={'onboarding:debtAccounts.noAccounts'} />
                </div>
              ) : (
                <div className="h-[200px] overflow-y-auto border rounded-md p-2 space-y-2">
                  {loanAccounts.map(account => {
                    const accountType = account.source === 'plaid'
                      ? state.budget.plaidConnectionItems
                          ?.flatMap(item => item.itemAccounts)
                          .find(plaidAcc => plaidAcc.svendAccountId === account.id)
                          ?.accountType
                      : state.budget.manualInstitutions
                          ?.flatMap(inst => inst.accounts)
                          .find(manualAcc => manualAcc.id === account.id)
                          ?.type;

                    return (
                      <div key={account.id} className="flex items-center text-sm p-2 bg-muted/50 rounded-md">
                        <div className="flex-1">
                          <span className="font-medium capitalize">{accountType}</span>
                          <span className="mx-2 text-muted-foreground">•</span>
                          <span className="text-muted-foreground">${Math.abs(account.balance).toLocaleString()}</span>
                          <span className="mx-2 text-muted-foreground">•</span>
                          <span>{account.institutionName} - {account.name}</span>
                          {account.mask && (
                            <>
                              <span className="mx-2 text-muted-foreground">•</span>
                              <span className="text-muted-foreground">***{account.mask}</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </form>
      </Form>
    </>
  );
}
