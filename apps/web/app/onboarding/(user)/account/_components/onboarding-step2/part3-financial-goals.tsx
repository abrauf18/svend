import React, { useEffect, useMemo, useRef } from 'react';

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

// Financial goals options
const financialGoals: Record<string, string> = {
  'Debt - Loans': 'Debt - Loans',
  'Debt - Credit Cards': 'Debt - Credit Cards',
  'Save - Build an emergency fund': 'Save - Build an emergency fund',
  'Save - Save for a house': 'Save - Save for a house',
  'Save - Save for retirement': 'Save - Save for retirement',
  "Save - Save for children's education": "Save - Save for children's education",
  'Save - Save for vacation or a large purchase': 'Save - Save for vacation or a large purchase',
  'Invest in stocks or bonds': 'Invest in stocks or bonds',
  'Donate to charity or tithe regularly': 'Donate to charity or tithe regularly',
  'Manage your money better': 'Manage your money better',
};

// Achieving goals options
const goalTimelineOptions: Record<string, string> = {
  '6 months': '6 months',
  '1 year': '1 year',
  '3 years': '3 years',
  '5 years or more': '5 years or more',
};

// Monthly contribution options
const monthlyContributionOptions: Record<string, string> = {
  'Less than $100': 'Less than $100',
  '$100 - $250': '$100 - $250',
  '$250 - $500': '$250 - $500',
  '$500 - $1,000': '$500 - $1,000',
  'More than $1,000': 'More than $1,000',
};

// Validation schema
const FormSchema = z.object({
  primaryFinancialGoals: z
    .array(z.string().refine((value) => Object.keys(financialGoals).includes(value), {
      message: 'Invalid primary financial goal selected',
    }))
    .min(1, 'At least one Primary goal must be selected'),
  goalTimeline: z.string().refine((value) => Object.keys(goalTimelineOptions).includes(value), {
    message: 'Invalid achieving goal selected',
  }),
  monthlyContribution: z.string().refine((value) => Object.keys(monthlyContributionOptions).includes(value), {
    message: 'Invalid monthly contribution selected',
  }),
});

export function FinancialGoals(props: {
  onValidationChange: (isValid: boolean) => void;
  triggerSubmit: (submitHandler: () => Promise<boolean>) => void;
  initialData: any;
}) {
  const { state, accountProfileDataUpdate } = useOnboardingContext();

  // Set default values using useMemo
  const defaultValues = React.useMemo(() => {
    if (props.initialData) {
      const primaryFinancialGoals = props.initialData.primaryFinancialGoals || [];
      const goalTimeline = props.initialData.goalTimeline || '';
      const monthlyContribution = props.initialData.monthlyContribution || '';

      return {
        primaryFinancialGoals,
        goalTimeline,
        monthlyContribution,
      };
    } else {
      return {
        primaryFinancialGoals: [],
        goalTimeline: '',
        monthlyContribution: '',
      };
    }
  }, [props.initialData]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues,
    mode: 'onChange',
  });

  const { reset } = form;

  useEffect(() => {
    if (props.initialData) {
      reset({
        primaryFinancialGoals: props.initialData.primaryFinancialGoals || [],
        goalTimeline: props.initialData.goalTimeline || '',
        monthlyContribution: props.initialData.monthlyContribution || '',
      });
    }
  }, [props.initialData]);

  useEffect(() => {
    props.onValidationChange(form.formState.isValid);
  }, [form.formState.isValid]);

  // Setup triggerSubmit
  useEffect(() => {
    props.triggerSubmit(async () => {
      if (form.formState.isValid) {
        try {
          const data = form.getValues();
          await serverSubmit(data);

          accountProfileDataUpdate({
            ...state.account.profileData,
            primaryFinancialGoals: data.primaryFinancialGoals,
            goalTimeline: data.goalTimeline,
            monthlyContribution: data.monthlyContribution,
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
      const response = await fetch('/api/onboarding/account/profile/goals', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          primaryFinancialGoals: data.primaryFinancialGoals,
          goalTimeline: data.goalTimeline,
          monthlyContribution: data.monthlyContribution,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          'Error updating financial profile - goals info: ' + errorData.error,
        );
      }
    } catch (error: any) {
      console.error(error);
      throw error;
    }

    return true;
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
                    {Object.entries(financialGoals).map(([key, value]) => (
                      <FormItem
                        key={key}
                        className="flex flex-row items-start space-x-3 space-y-0"
                      >
                        <FormControl>
                          <Checkbox
                            checked={field.value.includes(key)}
                            onCheckedChange={(checked) => {
                              const newValue = checked
                                ? [...field.value, key]
                                : field.value.filter(
                                    (value) => value !== key,
                                  );
                              field.onChange(newValue);
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">{value}</FormLabel>
                      </FormItem>
                    ))}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className={'w-3/5'}>
              <FormField
                name="goalTimeline"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'onboarding:goalTimeline.label'} />
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
                          {Object.entries(goalTimelineOptions).map(
                            ([key, value]) => (
                              <SelectItem key={key} value={key}>
                                <span className="text-sm capitalize">
                                  {value}
                                </span>
                              </SelectItem>
                            ),
                          )}
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
                name="monthlyContribution"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans
                        i18nKey={'onboarding:monthlyContribution.label'}
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
                          {Object.entries(monthlyContributionOptions).map(
                            ([key, value]) => (
                              <SelectItem key={key} value={key}>
                                <span className="text-sm capitalize">
                                  {value}
                                </span>
                              </SelectItem>
                            ),
                          )}
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
