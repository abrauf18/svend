import React, { useEffect, useState, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Trans } from '@kit/ui/trans';
import { BudgetGoal } from '~/lib/model/budget.types';
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
import { RadioGroup, RadioGroupItem } from '@kit/ui/radio-group';
import { BaseFormSchema } from './types';
import { Button } from '@kit/ui/button';
import { useBudgetOnboardingContext } from '~/components/budget-onboarding-context';

const paymentComponentOptions = [
  { value: 'principal', label: 'Principal Only' },
  { value: 'interest', label: 'Interest Only' },
  { value: 'principal_interest', label: 'Principal & Interest' },
];

const FormSchema = BaseFormSchema.extend({
  debtInterestRate: z.string()
    .min(1, "Interest rate is required")
    .refine((val) => {
      const parsed = parseFloat(val.replace(/[^0-9.-]/g, ''));
      return !isNaN(parsed) && parsed >= 0;
    }, "Interest rate must be a valid number"),
  debtPaymentComponent: z.enum(['principal', 'interest', 'principal_interest']),
  targetDate: z.string().refine((date) => {
    return new Date(date) > new Date();
  }, "Target date must be in the future"),
  subType: z.string()
});

export function DebtGoalForm(props: {
  onValidationChange: (isValid: boolean, isDirty: boolean) => void;
  triggerSubmit: (submitHandler: () => Promise<boolean>) => void;
  onGoalCreated: (goal: BudgetGoal) => void;
  initialData?: any;
  onFormStateChange: (data: any) => void;
  onDirtyStateChange: (isDirty: boolean) => void;
}) {
  const { state, accountBudgetGoalsUpsertOne, budgetSlug} = useBudgetOnboardingContext();
  const [accounts, setAccounts] = useState<Record<string, { name: string; balance: number }>>({});

  // Get the current goal from the budget goals
  const currentGoal = useMemo(() => {
    return state.budget.budget?.goals?.find(
      goal => goal.type === 'debt'
    );
  }, [state.budget.budget?.goals]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: currentGoal ? {
      name: currentGoal.name,
      budgetFinAccountId: currentGoal.budgetFinAccountId,
      balance: currentGoal.balance || 0,
      targetDate: currentGoal.targetDate,
      description: currentGoal.description || '',
      debtInterestRate: currentGoal.debtInterestRate?.toString() || '',
      debtPaymentComponent: currentGoal.debtPaymentComponent || 'principal_interest',
      subType: currentGoal.subType || 'loans'
    } : {
      name: '',
      budgetFinAccountId: '',
      balance: 0,
      targetDate: '',
      description: '',
      debtInterestRate: '',
      debtPaymentComponent: 'principal_interest',
      subType: 'loans'
    }
  });

  useEffect(() => {
    // Initialize form state - always start with disabled save button
    props.onValidationChange(false, false);
    props.onDirtyStateChange(false);

    if (currentGoal) {
      const initialData = {
        name: currentGoal.name,
        budgetFinAccountId: currentGoal.budgetFinAccountId,
        balance: currentGoal.balance || 0,
        targetDate: currentGoal.targetDate,
        description: currentGoal.description || '',
        debtInterestRate: currentGoal.debtInterestRate?.toString() || '',
        debtPaymentComponent: currentGoal.debtPaymentComponent || 'principal_interest',
        subType: currentGoal.subType || 'loans'
      };
      form.reset(initialData, {
        keepDirty: false,
        keepTouched: false
      });
    }

    const subscription = form.watch(() => {
      const values = form.getValues();
      const defaultValues = form.formState.defaultValues;
      const isDirty = JSON.stringify(values) !== JSON.stringify(defaultValues);
      
      // Check if all required fields are filled
      const hasRequiredFields = Boolean(
        values.name &&
        values.budgetFinAccountId &&
        values.targetDate &&
        values.subType &&
        values.debtInterestRate &&
        values.debtPaymentComponent
      );

      // Log validation state
      console.log('Form validation:', {
        hasRequiredFields,
        formErrors: form.formState.errors,
        values,
        defaultValues,
        isDirty
      });

      props.onFormStateChange(values);
      props.onValidationChange(hasRequiredFields, isDirty);
      props.onDirtyStateChange(isDirty);
    });

    return () => subscription.unsubscribe();
  }, [currentGoal]);

  // Separate effect for submit handler
  useEffect(() => {
    props.triggerSubmit(async () => {
      try {
        const data = form.getValues();
        const goal = await serverSubmit(data);
        props.onGoalCreated(goal);
        
        // Reset form with new data
        form.reset(data, {
          keepDirty: false,
          keepTouched: false
        });
        
        props.onValidationChange(false, false);
        props.onDirtyStateChange(false);
        props.onFormStateChange(data);
        
        // Update context
        accountBudgetGoalsUpsertOne(goal);
        
        return true;
      } catch (error) {
        console.error('Save failed:', error);
        return false;
      }
    });
  }, []);

  const serverSubmit = async (data: z.infer<typeof FormSchema>): Promise<BudgetGoal> => {
    try {
      const reqBody = {
        budgetId: state.budget.budget?.id,
        type: 'debt',
        name: data.name,
        budgetFinAccountId: data.budgetFinAccountId,
        balance: data.balance,
        targetDate: data.targetDate,
        description: data.description,
        subType: data.subType,
        id: currentGoal?.id,
        debtInterestRate: Number(data.debtInterestRate),
        debtPaymentComponent: data.debtPaymentComponent,
        amount: data.balance
      };
      
      const response = await fetch(`/api/onboarding/budget/${budgetSlug}/budget/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      });

      if (!response.ok) {
        throw new Error('Error creating budget goal: ' + (await response.json()).error);
      }

      const result = await response.json();
      const budgetGoal: BudgetGoal = result.budgetGoal;
      accountBudgetGoalsUpsertOne(budgetGoal);

      // Reset form with new values and ensure button is disabled
      form.reset(data, {
        keepDirty: false,
        keepTouched: false
      });
      props.onValidationChange(false, false);
      props.onDirtyStateChange(false);
      props.onFormStateChange(data);

      return budgetGoal;
    } catch (error: any) {
      console.error(error);
      throw error;
    }
  };

  useEffect(() => {
    const mappedAccounts = state.budget.budget?.linkedFinAccounts?.reduce(
      (acc, account) => ({
        ...acc,
        [account.budgetFinAccountId!]: {
          name: `${account.institutionName || ''} - ${account.name} - ***${account.mask}`,
          balance: account.balance,
        },
      }),
      {} as Record<string, { name: string; balance: number }>,
    );
    setAccounts(mappedAccounts || {});
  }, [state.budget.budget?.linkedFinAccounts]);

  const debtSubTypes = {
    'loans': 'Loans',
    'credit_cards': 'Credit Cards'
  };

  return (
    <Form {...form}>
      <form className="space-y-4 mt-2">
        <div className="max-w-[50%]">
          <FormField
            control={form.control}
            name="subType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Debt Type</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a goal type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(debtSubTypes).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          <div className="max-w-[50%]">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Goal Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="max-w-[50%]">
            <FormField
              control={form.control}
              name="debtInterestRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Interest Rate (%)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        value={field.value || ''}
                        type="text"
                        inputMode="decimal"
                        onChange={(e) => {
                          const newValue = e.target.value;
                          if (newValue === '' || /^\d*\.?\d*$/.test(newValue)) {
                            field.onChange(newValue);
                          }
                        }}
                        onBlur={(e) => {
                          const numericValue = parseFloat(e.target.value.replace(/[^0-9.]/g, ''));
                          if (isNaN(numericValue)) {
                            field.onChange('');
                          } else {
                            field.onChange(Math.abs(numericValue).toFixed(2));
                          }
                        }}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        %
                      </span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="max-w-[50%]">
            <FormField
              control={form.control}
              name="debtPaymentComponent"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Payment Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-1"
                    >
                      {paymentComponentOptions.sort((a, b) => b.value.localeCompare(a.value)).map((option) => (
                        <FormItem
                          key={option.value}
                          className="flex items-center space-x-3 space-y-0"
                        >
                          <FormControl>
                            <RadioGroupItem value={option.value} />
                          </FormControl>
                          <FormLabel className="font-normal">
                            {option.label}
                          </FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="max-w-[50%]">
            <FormField
              control={form.control}
              name="budgetFinAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked Account</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue('balance', accounts[value]?.balance ?? 0);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(accounts).map(([id, account]) => (
                        <SelectItem key={id} value={id}>
                          <span className="text-sm capitalize flex items-center justify-between w-full">
                            {account.name} -
                            <span className="text-muted-foreground">
                              &nbsp;${account.balance.toFixed(2)}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="max-w-[50%]">
            <FormField
              control={form.control}
              name="targetDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="max-w-[50%]">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </form>
    </Form>
  );
} 