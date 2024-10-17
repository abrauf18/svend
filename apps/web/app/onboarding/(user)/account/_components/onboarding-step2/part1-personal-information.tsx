import React, { useEffect } from "react";
import { Trans } from '@kit/ui/trans';
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@kit/ui/form";
import { Input } from "@kit/ui/input";
import { RadioGroup, RadioGroupItem } from "@kit/ui/radio-group";
import { cn } from "@kit/ui/utils";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const maritalStatusOptions = ['single', 'married', 'marriedWithKids', 'other'];
const maritalStatusOptionsServer = ['Single', 'Married', 'Married with Kids', 'Other'];
const dependents = ['yes', 'no'];

// Zod Schema
const FormSchema = z.object({
  name: z.string().min(1, "Name is required."),
  age: z.string().min(1, "Age is required.").refine((val) => !isNaN(Number(val)), "Age must be a valid number."),
  maritalStatus: z.enum(maritalStatusOptions as [string, ...string[]]).refine((val) => val !== '', "Marital Status is required.").transform((val) => maritalStatusOptionsServer[maritalStatusOptions.indexOf(val)]),
  dependent: z.enum(dependents as [string, ...string[]]).refine((val) => val !== '', "Dependent is required."),
});

export function PersonalInformation(props: {
  onValidationChange: (isValid: boolean) => void,
  triggerSubmit: (submitHandler: () => Promise<boolean>) => void
}) {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: '',
      age: '',
      maritalStatus: '',
      dependent: '',
    },
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
          console.error("Error submitting form:", error);
          return false;
        }
      }
      return false;
    });
  }, [form, props]);

  const serverSubmit = async (data: z.infer<typeof FormSchema>): Promise<boolean> => {
    try {
      const response = await fetch('/api/onboarding/account/profile/personal', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: data.name,
          age: Number(data.age),
          maritalStatus: maritalStatusOptionsServer[maritalStatusOptions.indexOf(data.maritalStatus as string)],
          dependents: data.dependent === 'yes' ? 1 : 0
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update financial profile');
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
        <Trans i18nKey={'onboarding:personalInformationTitle'}/>
      </h3>
      <Form {...form}>
        <form className={'flex flex-col space-y-4'}>
          <div className={'flex flex-col space-y-4'}>
            {/* Name Field */}
            <div className="w-2/5">
              <FormField
                control={form.control}
                name={'name'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'onboarding:personalInformationNameLabel'} />
                    </FormLabel>
                    <FormControl>
                      <Input
                        data-test={'personal-information-form-name-input'}
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

            {/* Age Field */}
            <div className="w-2/5">
              <FormField
                control={form.control}
                name={'age'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'onboarding:personalInformationAgeLabel'} />
                    </FormLabel>
                    <FormControl>
                      <Input
                        data-test={'personal-information-form-age-input'}
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

            {/* Marital Status Radio Group */}
            <div className="w-full">
              <FormField
                control={form.control}
                name={'maritalStatus'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'onboarding:maritalStatus.label'} />
                    </FormLabel>
                    <FormControl>
                      <RadioGroup
                        name={field.name}
                        value={field.value}
                        onValueChange={(value) => form.setValue('maritalStatus', value, {
                          shouldValidate: true, // Ensures the field is validated
                        })}
                      >
                        <div className={'flex space-x-2.5'}>
                          {maritalStatusOptions.map((option) => (
                            <label
                              htmlFor={option}
                              key={option}
                              className={cn(
                                'flex items-center space-x-2 rounded-md border border-transparent px-4 py-2 transition-colors',
                                {
                                  ['border-primary']: field.value === option,
                                  ['hover:border-primary']: field.value !== option,
                                },
                              )}
                            >
                              <RadioGroupItem
                                id={option}
                                value={option}
                                checked={field.value === option}
                              />
                              <span className={cn('text-sm', { ['cursor-pointer']: field.value !== option })}>
                                <Trans i18nKey={`onboarding:maritalStatus.${option}`} />
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

            {/* Dependent Radio Group */}
            <div className="w-full">
              <FormField
                control={form.control}
                name={'dependent'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'onboarding:dependents.label'} />
                    </FormLabel>
                    <FormControl>
                      <RadioGroup
                        name={field.name}
                        value={field.value}
                        onValueChange={(value) => form.setValue('dependent', value, {
                          shouldValidate: true, // Ensures the field is validated
                        })}
                      >
                        <div className={'flex space-x-2.5'}>
                          {dependents.map((option) => (
                            <label
                              htmlFor={option}
                              key={option}
                              className={cn(
                                'flex items-center space-x-2 rounded-md border border-transparent px-4 py-2 transition-colors',
                                {
                                  ['border-primary']: field.value === option,
                                  ['hover:border-primary']: field.value !== option,
                                },
                              )}
                            >
                              <RadioGroupItem
                                id={option}
                                value={option}
                                checked={field.value === option}
                              />
                              <span className={cn('text-sm', { ['cursor-pointer']: field.value !== option })}>
                                <Trans i18nKey={`onboarding:dependents.${option}`} />
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
          </div>
        </form>
      </Form>
    </>
  );
}
