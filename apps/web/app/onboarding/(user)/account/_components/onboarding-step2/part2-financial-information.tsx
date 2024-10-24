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

const incomeLevelOptions: Record<string, string> = {
  'lt_25k': 'Less than $25,000',
  '25k_50k': '$25,000 - $50,000',
  '50k_75k': '$50,000 - $75,000',
  '75k_100k': '$75,000 - $100,000',
  'gt_100k': 'More than $100,000',
};

const savingsLevelOptions: Record<string, string> = {
  'lt_1k': 'Less than $1,000',
  '1k_5k': '$1,000 - $5,000',
  '5k_10k': '$5,000 - $10,000',
  '10k_25k': '$10,000 - $25,000',
  'gt_25k': 'More than $25,000',
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
  initialData: {
    income_level: string;
    savings: string;
    current_debt: string[];
  } | null;
}) {
  const defaultValues = React.useMemo(() => {
    if (props.initialData) {
      console.log(props.initialData);
      const incomeLevelKey = Object.keys(incomeLevelOptions).find(
        (key) => incomeLevelOptions[key] === props.initialData?.income_level,
      );

      const savingsLevelKey = Object.keys(savingsLevelOptions).find(
        (key) => savingsLevelOptions[key] === props.initialData?.savings,
      );

      const mappedDebtTypes = props.initialData?.current_debt?.map(
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

  useEffect(() => {
    props.onValidationChange(form.formState.isValid);
  }, [form.formState.isValid, props]);

  useEffect(() => {
    props.onValidationChange(form.formState.isValid);
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
  }, [form, props]);

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
          errorData.error || 'Failed to update financial profile',
        );
      }

      const result = await response.json();
      console.log('Financial profile updated:', result);

      return true;
    } catch (error) {
      console.error('Error updating financial profile:', error);
      // Handle error (e.g., show error message to user)
    }

    return false;
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
                                  <Trans
                                    i18nKey={`onboarding:incomeLevel.${key}`}
                                    defaults={value}
                                  />
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
                      <Trans i18nKey={'onboarding:debtTypes.label'} />
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
                control={form.control}
                name="savingsLevel"
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
                                  <Trans
                                    i18nKey={`onboarding:savings.${key}`}
                                    defaults={value}
                                  />
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
