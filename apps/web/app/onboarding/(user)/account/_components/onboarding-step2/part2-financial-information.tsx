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

const incomeLevelOptions: Record<string, string> = {
  lt_25k: 'Less than $25,000',
  '25k_50k': '$25,000 - $50,000',
  '50k_75k': '$50,000 - $75,000',
  '75k_100k': '$75,000 - $100,000',
  gt_100k: 'More than $100,000',
};

const savingsLevelOptions: Record<string, string> = {
  lt_1k: 'Less than $1,000',
  '1k_5k': '$1,000 - $5,000',
  '5k_10k': '$5,000 - $10,000',
  '10k_25k': '$10,000 - $25,000',
  gt_25k: 'More than $25,000',
};

const debtTypeOptions: Record<string, string> = {
  creditCardDebt: 'Credit Cards',
  studentLoans: 'Student Loans',
  personalLoans: 'Personal Loans',
  mortgage: 'Mortgage',
  autoLoans: 'Auto Loans',
  others: 'Other',
};

const FormSchema = z.object({
  incomeLevel: z
    .string()
    .refine((value) => Object.keys(incomeLevelOptions).includes(value), {
      message: 'Invalid income level selected',
    }),
  savingsLevel: z
    .string()
    .refine((value) => Object.keys(savingsLevelOptions).includes(value), {
      message: 'Invalid savings level selected',
    }),
  debtTypes: z
    .array(
      z
        .string()
        .refine((value) => Object.keys(debtTypeOptions).includes(value), {
          message: 'Invalid debt type selected',
        }),
    )
    .min(1, 'At least one debt must be selected.'),
});

export function FinancialInformation(props: {
  onValidationChange: (isValid: boolean) => void;
  triggerSubmit: (submitHandler: () => Promise<boolean>) => void;
  initialData: any;
}) {
  const { state, accountProfileDataUpdate } = useOnboardingContext();

  const defaultValues = React.useMemo(() => {
    if (props.initialData) {
      const incomeLevelKey = Object.keys(incomeLevelOptions).find(
        (key) => incomeLevelOptions[key] === props.initialData?.incomeLevel,
      );

      const savingsLevelKey = Object.keys(savingsLevelOptions).find(
        (key) => savingsLevelOptions[key] === props.initialData?.savings,
      );

      const mappedDebtTypes = props.initialData?.currentDebt?.map(
        (debt: string) => {
          const debtKey = Object.keys(debtTypeOptions).find(
            (key) => debtTypeOptions[key] === debt,
          );
          return debtKey || '';
        },
      );

      return {
        incomeLevel: incomeLevelKey || '',
        savingsLevel: savingsLevelKey || '',
        debtTypes: mappedDebtTypes || [],
      };
    } else {
      return {
        incomeLevel: '',
        savingsLevel: '',
        debtTypes: [],
      };
    }
  }, [props.initialData]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues,
    mode: 'onChange',
  });

  const { reset } = form;
  const incomeLevelInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (incomeLevelInputRef.current) {
      incomeLevelInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (props.initialData) {
      reset({
        incomeLevel: Object.keys(incomeLevelOptions).find(
          (key) => incomeLevelOptions[key] === props.initialData?.incomeLevel,
        ) || '',
        savingsLevel: Object.keys(savingsLevelOptions).find(
          (key) => savingsLevelOptions[key] === props.initialData?.savings,
        ) || '',
        debtTypes: props.initialData?.currentDebt?.map(
          (debt: string) =>
            Object.keys(debtTypeOptions).find(
              (key) => debtTypeOptions[key] === debt,
            ) || '',
        ) || [],
      });
    }
  }, [props.initialData]);

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
            incomeLevel: incomeLevelOptions[data.incomeLevel],
            savingsLevel: savingsLevelOptions[data.savingsLevel],
            debtTypes: data.debtTypes.map(
              (debtType) => debtTypeOptions[debtType],
            ),
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
          incomeLevel: incomeLevelOptions[data.incomeLevel],
          savingsLevel: savingsLevelOptions[data.savingsLevel],
          debtTypes: data.debtTypes.map(
            (debtType) => debtTypeOptions[debtType],
          ),
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
                name="incomeLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'onboarding:incomeLevel.label'} />
                    </FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger data-test={'income-selector-trigger'}>
                          <SelectValue placeholder="Select income level" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(incomeLevelOptions).map(
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

            {/* Current Debt */}
            <div className={'w-2/5'}>
              <FormField
                control={form.control}
                name="debtTypes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">
                      <Trans i18nKey={'onboarding:loanType.label'} />
                    </FormLabel>
                    {Object.entries(debtTypeOptions).map(([key, value]) => (
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
                                : field.value.filter((v) => v !== key);
                              field.onChange(newValue);
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">
                          <Trans
                            i18nKey={`onboarding:currentDebt.${key}`}
                            defaults={value}
                          />
                        </FormLabel>
                      </FormItem>
                    ))}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Savings */}
            <div className={'w-2/5'}>
              <FormField
                name="savingsLevel"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'onboarding:savingsLevel.label'} />
                    </FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger data-test={'savings-selector-trigger'}>
                          <SelectValue placeholder="Select savings level" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(savingsLevelOptions).map(
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
