import React, { useEffect } from 'react';

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

// Validation schema
const FormSchema = z.object({
  primaryFinancialGoals: z
    .array(z.string())
    .min(1, 'At least one Primary goal must be selected'),
  achievingGoals: z.string().min(1, 'Achieving Goal is required.'),
  monthlyContributions: z.string().min(1, 'Monthly contribution is required.'),
});

export function FinancialGoals(props: {
  onValidationChange: (isValid: boolean) => void;
  triggerSubmit: (submitHandler: () => Promise<boolean>) => void;
  initialData: {
    primary_financial_goal: string[];
    goal_timeline: string;
    monthly_contribution: string;
  } | null;
}) {
  // Financial goals options
  const financialGoals = [
    { id: 'Debt - Loans', label: 'Debt - Loans' },
    { id: 'Debt - Credit Cards', label: 'Debt - Credit Cards' },
    {
      id: 'Save - Build an emergency fund',
      label: 'Save - Build an emergency fund',
    },
    { id: 'Save - Save for a house', label: 'Save - Save for a house' },
    { id: 'Save - Save for retirement', label: 'Save - Save for retirement' },
    {
      id: "Save - Save for children's education",
      label: "Save - Save for children's education",
    },
    {
      id: 'Save - Save for vacation or a large purchase',
      label: 'Save - Save for vacation or a large purchase',
    },
    { id: 'Invest in stocks or bonds', label: 'Invest in stocks or bonds' },
    {
      id: 'Donate to charity or tithe regularly',
      label: 'Donate to charity or tithe regularly',
    },
    { id: 'Manage your money better', label: 'Manage your money better' },
  ];

  // Achieving goals options
  const achievingGoals = [
    { id: '6 months', label: '6 months' },
    { id: '1 year', label: '1 year' },
    { id: '3 years', label: '3 years' },
    { id: '5 years or more', label: '5 years or more' },
  ];

  // Monthly contribution options
  const monthlyContributions = [
    { id: 'Less than $100', label: 'Less than $100' },
    { id: '$100 - $250', label: '$100 - $250' },
    { id: '$250 - $500', label: '$250 - $500' },
    { id: '$500 - $1,000', label: '$500 - $1,000' },
    { id: 'More than $1,000', label: 'More than $1,000' },
  ];

  // Set default values using useMemo
  const defaultValues = React.useMemo(() => {
    if (props.initialData) {
      return {
        primaryFinancialGoals: props.initialData.primary_financial_goal || [],
        achievingGoals: props.initialData.goal_timeline || '',
        monthlyContributions: props.initialData.monthly_contribution || '',
      };
    } else {
      return {
        primaryFinancialGoals: [],
        achievingGoals: '',
        monthlyContributions: '',
      };
    }
  }, [props.initialData]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues,
    mode: 'onChange',
  });

  // Reset form when initialData changes
  useEffect(() => {
    if (props.initialData) {
      form.reset(defaultValues);
    }
  }, [props.initialData, form.reset, defaultValues]);

  // Update validation state
  useEffect(() => {
    props.onValidationChange(form.formState.isValid);
  }, [form.formState.isValid]);

  // Setup triggerSubmit
  useEffect(() => {
    props.triggerSubmit(async () => {
      if (form.formState.isValid) {
        try {
          const data = form.getValues();
          const result = await serverSubmit(data);
          return result;
        } catch (error) {
          console.error('Error submitting form:', error);
          return false;
        }
      }
      return false;
    });
  }, [props.triggerSubmit, form]);

  const serverSubmit = async (
    data: z.infer<typeof FormSchema>,
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/onboarding/account/profile/goals', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          primary_financial_goal: data.primaryFinancialGoals,
          goal_timeline: data.achievingGoals,
          monthly_contribution: data.monthlyContributions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || 'Failed to update financial profile',
        );
      }

      const result = await response.json();
      console.log('Financial profile updated:', result);
      return true;
    } catch (error) {
      console.error('Error updating financial profile:', error);
      return false;
    }
  };

  return (
    <>
      <h3 className="text-xl font-semibold">
        <Trans i18nKey={'onboarding:financialGoalsTitle'} />
      </h3>
      <Form {...form}>
        <form className={'flex flex-col space-y-4'}>
          <div className={'flex flex-col space-y-4'}>
            <div className={'w-2/5'}>
              <FormField
                control={form.control}
                name="primaryFinancialGoals"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">
                      <Trans i18nKey={'onboarding:financialGoals.label'} />
                    </FormLabel>
                    {financialGoals.map((item) => (
                      <FormItem
                        key={item.id}
                        className="flex flex-row items-start space-x-3 space-y-0"
                      >
                        <FormControl>
                          <Checkbox
                            checked={field.value.includes(item.id)}
                            onCheckedChange={(checked) => {
                              const newValue = checked
                                ? [...field.value, item.id]
                                : field.value.filter(
                                    (value) => value !== item.id,
                                  );
                              field.onChange(newValue);
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">
                          {item.label}
                        </FormLabel>
                      </FormItem>
                    ))}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className={'w-3/5'}>
              <FormField
                name="achievingGoals"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'onboarding:achievingGoals.label'} />
                    </FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          data-test={'goal-timeline-selector-trigger'}
                        >
                          <SelectValue placeholder="Select Achieving Goal" />
                        </SelectTrigger>
                        <SelectContent>
                          {achievingGoals.map((goal) => (
                            <SelectItem key={goal.id} value={goal.id}>
                              <span className="text-sm capitalize">
                                {goal.label}
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

            <div className={'w-3/5'}>
              <FormField
                name="monthlyContributions"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans
                        i18nKey={'onboarding:monthlyContributions.label'}
                      />
                    </FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          data-test={'contribution-selector-trigger'}
                        >
                          <SelectValue placeholder="Select Monthly Contribution" />
                        </SelectTrigger>
                        <SelectContent>
                          {monthlyContributions.map((contribution) => (
                            <SelectItem
                              key={contribution.id}
                              value={contribution.id}
                            >
                              <span className="text-sm capitalize">
                                {contribution.label}
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
          </div>
        </form>
      </Form>
    </>
  );
}
