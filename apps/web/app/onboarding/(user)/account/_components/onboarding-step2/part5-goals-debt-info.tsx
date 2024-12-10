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
import { RadioGroup, RadioGroupItem } from '@kit/ui/radio-group';
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
import { cn } from '@kit/ui/utils';
import { useOnboardingContext } from '~/components/onboarding-context';
import { BudgetGoal } from '~/lib/model/budget.types';

const paymentComponent = ['principal', 'interest', 'principal_interest'];
const paymentComponentOptionsServer = [
  'principal',
  'interest',
  'principal_interest',
];

const debtTypes: Record<string, string> = {
  'credit_cards': 'Credit Cards',
  'student_loans': 'Student Loans',
  'personal_loans': 'Personal Loans',
  'mortgage': 'Mortgage',
  'auto_loans': 'Auto Loans',
  'business_loans': 'Business Loans',
  'other': 'Other',
};

// Zod Schema
const FormSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  debtType: z
    .string()
    .refine((value) => Object.values(debtTypes).includes(value), {
      message: 'Invalid loan type selected',
    }),
  budgetFinAccountId: z
    .string()
    .uuid('Invalid account ID format. Must be a valid UUID.'),
  balance: z.number(),
  debtPaymentComponent: z
    .enum(paymentComponentOptionsServer as [string, ...string[]], {
      required_error: 'Payment component is required.',
    }),
  debtInterestRate: z
    .string()
    .min(1, 'Interest is required.')
    .refine((val) => {
      const num = Number(val);
      return !isNaN(num) && num < 100;
    }, 'Interest must be a valid number'),
  targetDate: z
    .string()
    .refine(
      (val) => val === undefined || /^\d{4}-\d{2}-\d{2}$/.test(val),
      'Invalid date format. Use yyyy-MM-dd format.',
    )
    .refine(
      (val) => {
        if (!val) return true;
        const today = new Date();
        today.setHours(0, 0, 0, 0);  // Normalize to start of day
        
        const targetDate = new Date(val);
        targetDate.setHours(0, 0, 0, 0);  // Normalize to start of day
        
        return targetDate > today;  // Must be strictly greater than today
      },
      'Target date must be in the future.',
    ),
  description: z.string().optional(),
});

export function PayOffDebtInformation(props: {
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

  const defaultValues = React.useMemo(() => {
    if (props.initialData) {
      return {
        name: props.initialData.name || '',
        debtType: props.initialData.debtType || '',
        budgetFinAccountId: props.initialData.budgetFinAccountId || '',
        debtPaymentComponent: props.initialData.debtPaymentComponent || '',
        debtInterestRate: String(props.initialData.debtInterestRate) || '',
        targetDate: props.initialData.targetDate || '',
        description: props.initialData.description || '',
      };
    }
    return {
      name: '',
      debtType: '',
      budgetFinAccountId: '',
      debtPaymentComponent: '',
      debtInterestRate: '',
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
        debtType: props.initialData.debtType || '',
        budgetFinAccountId: props.initialData.budgetFinAccountId || '',
        debtPaymentComponent: props.initialData.debtPaymentComponent || '',
        debtInterestRate: String(props.initialData.debtInterestRate) || '',
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
      const response = await fetch(
        '/api/onboarding/account/budget/goals',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            budgetId: state.account.budget?.id,
            type: 'debt',
            name: data.name,
            debtType: data.debtType,
            budgetFinAccountId: data.budgetFinAccountId,
            debtPaymentComponent: data.debtPaymentComponent,
            amount: Math.abs(data.balance),
            balance: data.balance,
            debtInterestRate: data.debtInterestRate,
            targetDate: data.targetDate,
            description: data.description
          }),
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
                defaults="Payoff Debt"
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
                      <Trans i18nKey={'onboarding:loanGoalNameLabel'} />
                    </FormLabel>
                    <FormControl>
                      <Input
                        data-test={'debt-form-name-input'}
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

            {/* Loan Type Select */}
            <div className={'w-2/5'}>
              <FormField
                control={form.control}
                name="debtType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'onboarding:debtType.label'} />
                    </FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger data-test={'debt-type-selector-trigger'}>
                          <SelectValue placeholder="Select loan type" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(debtTypes).map(([key, value]) => (
                            <SelectItem key={key} value={value}>
                              <span className="text-sm capitalize">
                                {value}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                          <SelectTrigger data-test={'account-selector-trigger'}>
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
            <div className="w-2/5">
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

            {/* Payment Component Radio Group */}
            <div className="w-full">
              <FormField
                control={form.control}
                name={'debtPaymentComponent'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'onboarding:paymentComponent.label'} />
                    </FormLabel>
                    <FormControl>
                      <RadioGroup
                        name={field.name}
                        value={field.value}
                        onValueChange={(value) =>
                          form.setValue('debtPaymentComponent', value, {
                            shouldValidate: true, // Ensures the field is validated
                          })
                        }
                      >
                        <div className={'flex space-x-2.5'}>
                          {paymentComponent.map((option) => (
                            <label
                              htmlFor={option}
                              key={option}
                              className={cn(
                                'flex items-center space-x-2 rounded-md border border-transparent px-4 py-2 transition-colors',
                                {
                                  ['border-primary']: field.value === option,
                                  ['hover:border-primary']:
                                    field.value !== option,
                                },
                              )}
                            >
                              <RadioGroupItem
                                id={option}
                                value={option}
                                checked={field.value === option}
                              />
                              <span
                                className={cn('text-sm', {
                                  ['cursor-pointer']: field.value !== option,
                                })}
                              >
                                <Trans
                                  i18nKey={`onboarding:paymentComponent.${option}`}
                                />
                              </span>
                            </label>
                          ))}
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Interest Rate Field */}
            <div className="w-2/5">
              <FormField
                control={form.control}
                name={'debtInterestRate'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'onboarding:interestRateLabel'} />
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          className="pr-7"
                          data-test={'debt-form-interest-rate-input'}
                          required
                          type={'number'}
                          {...field}
                          value={field.value ?? ''}
                        />
                        <div className="absolute right-14 top-1/2 transform -translate-y-1/2 pointer-events-none">
                          %
                        </div>
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
                        data-test={'debt-form-target-date-input'}
                        required
                        type={'date'}
                        {...field}
                        value={field.value ?? ''}
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
                        data-test={'debt-form-description-input'}
                        required
                        type={'string'}
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
