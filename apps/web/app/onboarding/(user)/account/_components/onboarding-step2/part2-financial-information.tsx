import React, { useEffect, useRef } from 'react';

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
import { useOnboardingContext } from '@kit/accounts/components';
import { ProfileData } from '~/lib/model/fin.types';
import { Input } from '@kit/ui/input';
import { OnboardingState } from '~/lib/model/onboarding.types';

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
  const manualInstitutions = state.account.manualInstitutions || [];
  const plaidConnections = state.account.plaidConnectionItems || [];
  const categoryGroups = state.account.svendCategoryGroups || {};
  
  // Find Income category group
  const incomeGroup = Object.values(categoryGroups).find(group => 
    group.name.toLowerCase() === 'income'
  );
  if (!incomeGroup) return "";
  
  // Calculate date 30 days ago from today
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);

  // Get manual transactions (with logging)
  const manualTransactions = manualInstitutions.flatMap(inst => 
    inst.accounts.flatMap(acc => {
      const transactions = acc.budgetFinAccountId 
        ? acc.transactions.filter(tx => {
            const isIncome = incomeGroup.categories.some(c => c.id === tx.svendCategoryId);
            const isPosted = tx.status === 'posted';
            const isRecent = new Date(tx.date) >= thirtyDaysAgo;
            return isIncome && isPosted && isRecent;
          })
        : [];
      return transactions;
    })
  );

  // Get Plaid transactions
  const plaidTransactions = plaidConnections.flatMap(conn => 
    conn.itemAccounts.flatMap(acc => {
      const transactions = (acc.transactions || []).filter(tx => {
        const isIncome = tx.categoryGroup?.toLowerCase() === 'income';
        const isPosted = tx.transaction.status === 'posted';
        const isRecent = new Date(tx.transaction.date) >= thirtyDaysAgo;
        
        return isIncome && isPosted && isRecent;
      });
      return transactions;
    })
  );

  // Calculate total
  const annualIncome = Math.round(
    (manualTransactions.reduce((sum, tx) => 
      sum + Math.abs(Number(tx.amount)), 0) +
    plaidTransactions.reduce((sum, tx) => 
      sum + Math.abs(Number(tx.transaction.amount)), 0)) * 12
  );

  return annualIncome <= 0 ? "" : annualIncome.toString();
};

const calculateDefaultSavings = (state: OnboardingState): string => {
  const linkedAccounts = state.account.budget?.linkedFinAccounts || [];
  
  // Sum balances of all depository accounts
  const totalSavings = linkedAccounts
    .filter(account => {
      const accountType = account.source === 'plaid'
        ? state.account.plaidConnectionItems
            ?.flatMap(item => item.itemAccounts)
            .find(plaidAcc => plaidAcc.svendAccountId === account.id)
            ?.accountType
        : state.account.manualInstitutions
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
  const { state, accountProfileDataUpdate } = useOnboardingContext();

  const defaultValues = React.useMemo(() => {
    if (props.initialData) {
      return {
        annualIncome: props.initialData?.annualIncome?.toString() || calculateDefaultIncome(state),
        savings: props.initialData?.savings?.toString() || calculateDefaultSavings(state),
      };
    } else {
      return {
        annualIncome: calculateDefaultIncome(state),
        savings: calculateDefaultSavings(state),
      };
    }
  }, [props.initialData, state]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues,
    mode: 'onChange',
  });

  const { reset } = form;
  const annualIncomeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (annualIncomeInputRef.current) {
      annualIncomeInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (props.initialData) {
      reset({
        annualIncome: props.initialData?.annualIncome?.toString() || calculateDefaultIncome(state),
        savings: props.initialData?.savings?.toString() || calculateDefaultSavings(state),
      });
    }
  }, [props.initialData, state]);

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
            ...state.account.profileData,
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
      const response = await fetch('/api/onboarding/account/profile/fin', {
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

  const loanAccounts = state.account.budget?.linkedFinAccounts.filter(account => {
    const accountType = account.source === 'plaid'
      ? state.account.plaidConnectionItems
          ?.flatMap(item => item.itemAccounts)
          .find(plaidAcc => plaidAcc.svendAccountId === account.id)
          ?.accountType
      : state.account.manualInstitutions
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
                      ? state.account.plaidConnectionItems
                          ?.flatMap(item => item.itemAccounts)
                          .find(plaidAcc => plaidAcc.svendAccountId === account.id)
                          ?.accountType
                      : state.account.manualInstitutions
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
