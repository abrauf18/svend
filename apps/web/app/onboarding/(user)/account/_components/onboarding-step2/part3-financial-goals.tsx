import React, { useEffect } from "react";
import { Trans } from "@kit/ui/trans";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@kit/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kit/ui/select";
import { Checkbox } from "@kit/ui/checkbox";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const FormSchema = z.object({
  primaryFinancialGoals: z.array(z.string()).min(1, "At least one Primary goal must be selected"),
  achievingGoals: z.string().min(1, "Achieving Goal is required."),
  monthlyContributions: z.string().min(1, "Monthly contribution is required."),
});

export function FinancialGoals(props: { 
  onValidationChange: (isValid: boolean) => void,
  triggerSubmit: (submitHandler: () => Promise<boolean>) => void
}) {
    const monthlyContributions = [
        "levelOne",
        "levelTwo",
        "levelThree",
        "levelFour",
        "levelFive",
    ];
    const financialGoals = [
    { id: "debt", label: "Debt" },
    { id: "loans", label: "Loans" },
    { id: "creditCards", label: "Credit Cards" },
    { id: "buildAnEmergencyFund", label: "Build an Emergency Fund" },
    { id: "saveForAHouse", label: "Save for a House" },
    { id: "saveForARetirement", label: "Save for Retirement" },
    { id: "saveForChildrenEducation", label: "Save for Children Education" },
    { id: "investInStocksOrBonds", label: "Invest in Stocks or Bonds" },
    { id: "donateToCharityOrTitheRegularly", label: "Donate to Charity or Tithe Regularly" },
    { id: "manageYourMoneyBetter", label: "Manage Your Money Better" }
  ];

  const achievingGoals = [
    "sixMonth",
    "oneYear",
    "threeYear",
    "fiveYearsOrMore"
  ];
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      primaryFinancialGoals: [],
      achievingGoals: '',
      monthlyContributions: '',
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
          // const result = await serverSubmit(data);
          // return result;
          return true;
        } catch (error) {
          console.error("Error submitting form:", error);
          return false;
        }
      }
      return false;
    });
  }, [form, props]);

  // const serverSubmit = async (data: z.infer<typeof FormSchema>): Promise<boolean> => {
  //   try {
  //     const response = await fetch('/api/onboarding/account/profile/fin', {
  //       method: 'PUT',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({
  //         incomeLevel: incomeLevelOptions[data.incomeLevel],
  //         savingsLevel: savingsLevelOptions[data.savingsLevel],
  //         debtTypes: data.debtTypes.map(debtType => debtTypeOptions[debtType])
  //       }),
  //     });

  //     if (!response.ok) {
  //       const errorData = await response.json();
  //       throw new Error(errorData.error || 'Failed to update financial profile');
  //     }

  //     const result = await response.json();
  //     console.log('Financial profile updated:', result);

  //     return true;
  //   } catch (error) {
  //     console.error('Error updating financial profile:', error);
  //     // Handle error (e.g., show error message to user)
  //   }

  //   return false;
  // };

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
                      <FormItem key={item.id} className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value.includes(item.id)}
                            onCheckedChange={(checked) => {
                              const newValue = checked
                                ? [...field.value, item.id]
                                : field.value.filter((value) => value !== item.id);
                              field.onChange(newValue);
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">{item.label}</FormLabel>
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
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger data-test={'income-selector-trigger'}>
                          <SelectValue placeholder="Select Achieving Goal" />
                        </SelectTrigger>
                        <SelectContent>
                          {achievingGoals.map((goal) => (
                            <SelectItem key={goal} value={goal}>
                              <span className="text-sm capitalize">
                                <Trans i18nKey={`onboarding:achievingGoals.${goal}`} />
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
                      <Trans i18nKey={'onboarding:monthlyContributions.label'} />
                    </FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger data-test={'income-selector-trigger'}>
                          <SelectValue placeholder="Select Monthly Contribution" />
                        </SelectTrigger>
                        <SelectContent>
                          {monthlyContributions.map((contribution) => (
                            <SelectItem key={contribution} value={contribution}>
                              <span className="text-sm capitalize">
                                <Trans i18nKey={`onboarding:monthlyContributions.${contribution}`} />
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
