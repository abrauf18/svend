import React, { useEffect, useState } from 'react';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Trans } from '@kit/ui/trans';
import { useOnboardingContext } from '~/components/onboarding-context';
import { BudgetGoal } from '~/lib/model/budget.types';

// Zod Schema
const FormSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  amount: z
    .union([z.string(), z.number()])
    .refine((val) => {
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return !isNaN(num) && num > 0;
    }, 'Amount must be a positive number.')
    .transform((val) => val.toString()),
  budgetFinAccountId: z
    .string()
    .uuid('Invalid account ID format. Must be a valid UUID.'),
  balance: z.number(),
  targetDate: z
    .string()
    .refine(
      (val) => val === undefined || /^\d{4}-\d{2}-\d{2}$/.test(val),
      'Invalid date format. Use yyyy-MM-dd format.',
    ),
  description: z.string().optional(),
});

export function InvestmentInformation(props: {
  initialData: any;
  onValidationChange: (isValid: boolean) => void;
  triggerSubmit: (submitHandler: () => Promise<boolean>) => void;
}) {
  const [accounts, setAccounts] = useState<Record<string, { name: string; balance: number }>>({});
  const { state, accountBudgetGoalsAddOne } = useOnboardingContext();

  useEffect(() => {
    const accountsData = state.account.plaidConnectionItems
      ?.flatMap((item) => item.itemAccounts.map((account) => ({
        ...account,
        institutionName: item.institutionName,
      })))
      .filter((account) => !!account.budgetFinAccountId)
      .reduce((acc: Record<string, { name: string; balance: number }>, account) => {
        if (account.budgetFinAccountId) {
          acc[account.budgetFinAccountId] = {
            name: `${account.institutionName} - ${account.accountName} - ***${account.mask}`,
            balance: account.balanceCurrent,
          };
        }
        return acc;
      }, {});
    setAccounts(accountsData as Record<string, { name: string; balance: number }>);
  }, [state.account.plaidConnectionItems]);

  // Set default values using useMemo
  const defaultValues = React.useMemo(() => {
    if (props.initialData) {
      return {
        name: props.initialData.name || '',
        amount: props.initialData.amount || '',
        budgetFinAccountId: props.initialData.budgetFinAccountId || '',
        targetDate: props.initialData.targetDate || '',
        description: props.initialData.description || '',
      };
    }
    return {
      name: '',
      amount: '',
      budgetFinAccountId: '',
      targetDate: '',
      description: '',
    };
  }, [props.initialData]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues,
    mode: 'onChange',
  });

  const { reset, formState } = form;

  useEffect(() => {
    if (props.initialData) {
      reset({
        name: props.initialData.name || '',
        amount: props.initialData.amount || '',
        budgetFinAccountId: props.initialData.budgetFinAccountId || '',
        targetDate: props.initialData.targetDate || '',
        description: props.initialData.description || '',
      });
    }
  }, [props.initialData]);

  useEffect(() => {
    props.onValidationChange(formState.isValid);
  }, [formState.isValid]);

  useEffect(() => {
    if (form.getValues('budgetFinAccountId')) {
      form.setValue('balance', accounts[form.getValues('budgetFinAccountId')]?.balance ?? 0);
    }
  }, [accounts]);

  // Setup triggerSubmit
  useEffect(() => {
    props.triggerSubmit(async () => {
      if (form.formState.isValid) {
        try {
          const data = form.getValues();
          let budgetGoal = await serverSubmit(data);

          // server updated successfully, update local state
          accountBudgetGoalsAddOne(budgetGoal);

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
  ): Promise<BudgetGoal> => {
    try {
      console.log('data', data);
      const response = await fetch(
        '/api/onboarding/account/budget/goals',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            budgetId: state.account.budget?.id,
            type: 'investment',
            name: data.name,
            amount: data.amount,
            budgetFinAccountId: data.budgetFinAccountId,
            targetDate: data.targetDate,  
            description: data.description
          })
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error('Error creating budget goal: ' + errorData.error);
      }

      const result = await response.json();

      return result.budgetGoal;
    } catch (error: any) {
      console.error(error);
      throw error;
    }
  };

  return (
    <>
      <Form {...form}>
        <form className={'flex flex-col space-y-4'}>
          <div className={'flex flex-col space-y-4'}>
            <h2 className="mb-4 text-xl font-semibold">
              <Trans
                i18nKey={'onboarding:goalsHeading'}
                defaults="Investments Information"
              />
            </h2>

            {/* Name Field */}
            <div className="w-2/5">
              <FormField
                control={form.control}
                name={'name'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'onboarding:investmentGoalNameLabel'} />
                    </FormLabel>
                    <FormControl>
                      <Input
                        data-test={'investment-form-name-input'}
                        required
                        type={'text'}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Amount Field */}
            <div className="w-2/5">
              <FormField
                control={form.control}
                name={'amount'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'onboarding:budgetGoals.investmentAmount'} />
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2">$</span>
                        <Input
                          className="pl-7"
                          data-test={'investment-form-amount-input'}
                          required
                          type={'number'}
                          {...field}
                          value={field.value ?? ''}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Account Select */}
            <div className={'w-2/5'}>
              <FormField
                control={form.control}
                name="budgetFinAccountId"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>
                        <Trans i18nKey={'onboarding:accounts.label'} />
                      </FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue('balance', accounts[value]?.balance ?? 0);
                          }}
                        >
                          <SelectTrigger data-test={'investment-form-account-selector-trigger'}>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(accounts).map(([key, value]) => (
                              <SelectItem key={key} value={key}>
                                <span className="text-sm capitalize">{value.name}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            {/* Balance Field */}
            <div className="w-2/5 pl-4">
              <FormField
                control={form.control}
                name={'balance'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'onboarding:budgetGoals.investmentBalance'} />
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span
                          className={`
                            absolute 
                            left-3 
                            top-1/2 
                            transform 
                            -translate-y-1/2
                            ${!form.getValues('budgetFinAccountId') ? 'opacity-50' : ''}
                          `}>$</span>
                        <Input
                          className="pl-7 border-none outline-none pointer-events-none"
                          data-test={'investment-form-balance-input'}
                          type={'string'}
                          {...field}
                          value={form.getValues('budgetFinAccountId') ? field.value ?? '' : ''}
                          readOnly
                          tabIndex={-1}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Date Field */}
            <div className="w-1/5">
              <FormField
                control={form.control}
                name={'targetDate'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'onboarding:targetDateLabel'} />
                    </FormLabel>
                    <FormControl>
                      <Input
                        data-test={'investment-form-target-date-input'}
                        required
                        type={'date'}
                        {...field}
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Description Field */}
            <div className="w-2/5">
              <FormField
                control={form.control}
                name={'description'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'onboarding:savingDescriptionLabel'} />
                    </FormLabel>
                    <FormControl>
                      <Input
                        data-test={'investment-form-description-input'}
                        type={'text'}
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </form>
      </Form>
    </>
  );
}
