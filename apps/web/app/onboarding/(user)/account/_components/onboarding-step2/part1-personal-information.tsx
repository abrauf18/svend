import React, { useEffect, useRef } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import { Trans } from '@kit/ui/trans';
import { useOnboardingContext } from '@kit/accounts/components';
import { ProfileData } from '~/lib/model/fin.types';

// Zod Schema
const FormSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  age: z
    .string()
    .min(1, 'Age is required.')
    .refine((val) => {
      const num = parseInt(val);
      return !isNaN(num) && num >= 5 && num <= 120;
    }, 'Age must be between 5 and 120.')
});

export function PersonalInformation(props: {
  onValidationChange: (isValid: boolean) => void;
  triggerSubmit: (submitHandler: () => Promise<boolean>) => void;
  initialData: any;
}) {
  const { state, accountProfileDataUpdate } = useOnboardingContext();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: '',
      age: '',
    },
    mode: 'onChange',
  });

  const { reset, setValue } = form;
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, []);

  const mapMaritalStatus = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'single':
        return 'single';
      case 'married':
        return 'married';
      case 'married with kids':
        return 'marriedWithKids';
      case 'other':
        return 'other';
      default:
        return '';
    }
  };

  // Update the form with initialData once it's available
  useEffect(() => {
    if (props.initialData) {
      reset({
        name: props.initialData.fullName || '',
        age: props.initialData.age || '',
      });
    }
  }, [props.initialData]);

  // Ensure form validation state is updated
  useEffect(() => {
    props.onValidationChange(form.formState.isValid);
  }, [form.formState.isValid]);

  useEffect(() => {
    props.triggerSubmit(async () => {
      if (form.formState.isValid) {
        try {
          const data = form.getValues();
          const success = await serverSubmit(data);

          if (!success) {
            return false;
          }

          accountProfileDataUpdate({
            ...state.account.profileData,
            name: data.name,
            age: data.age,
          } as ProfileData);

          return true;
        } catch (error) {
          console.error('Error submitting form:', error);
          return false;
        }
      }
      return false;
    });
  }, [form]);

  const serverSubmit = async (data: z.infer<typeof FormSchema>): Promise<boolean> => {
    try {
      const response = await fetch('/api/onboarding/account/profile/personal', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: data.name,
          age: parseInt(data.age),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      // Only update local state if the API call was successful
      accountProfileDataUpdate({
        ...state.account.profileData,
        name: data.name,
        age: data.age,
      } as ProfileData);

      return true;
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to save information. Please try again later.');
      return false;
    }
  };

  return (
    <>
      <h3 className="text-xl font-semibold">
        <Trans i18nKey={'onboarding:personalInformationTitle'} />
      </h3>
      <Form {...form}>
        <form className={'flex flex-col space-y-8'}>
          <div className={'flex flex-col space-y-8'}>
            {/* Name Field */}
            <div className={'w-2/5'}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'onboarding:personalInformationNameLabel'} />
                    </FormLabel>
                    <FormControl>
                      <Input {...field} ref={nameInputRef} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Age Field */}
            <div className={'w-2/5'}>
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'onboarding:personalInformationAgeLabel'} />
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={3}
                        className="w-24"
                        onChange={(e) => {
                          // Only allow numeric input
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          field.onChange(value);
                        }}
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
