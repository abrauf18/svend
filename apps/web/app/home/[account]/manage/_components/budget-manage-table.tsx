'use client';

import React, { forwardRef, use, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';

import { Checkbox } from '@kit/ui/checkbox';
import { Input } from '@kit/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';
import { Switch } from '@kit/ui/switch';
import { cn } from '@kit/ui/utils';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@kit/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createCategoryService } from '~/lib/server/category.service';
import { useBudgetWorkspace } from '~/components/budget-workspace-context';
import { getSupabaseBrowserClient } from "@kit/supabase/browser-client";

// Reuse the same schema structure from onboarding
const CategorySchema = z.object({
  id: z.string().optional(),
  categoryName: z.string(),
  spending: z.number().optional(),
  recommendation: z.number().optional(),
  target: z.string().transform((val) => {
    const parsed = parseFloat(val.replace(/[^0-9.-]/g, ''));
    return isNaN(parsed) ? '0.00' : roundCurrency(parsed).toFixed(2);
  }),
  isTaxDeductible: z.boolean(),
});

const CategoryGroupSchema = z.object({
  groupId: z.string().optional(),
  groupName: z.string(),
  spending: z.number().optional(),
  recommendation: z.number().optional(),
  target: z.string().transform((val) => {
    const parsed = parseFloat(val.replace(/[^0-9.-]/g, ''));
    return isNaN(parsed) ? '0.00' : roundCurrency(parsed).toFixed(2);
  }),
  isTaxDeductible: z.boolean(),
  targetSource: z.enum(['group', 'category']),
  categories: z.array(CategorySchema),
});

export const BudgetFormSchema = z.object({
  categoryGroups: z.array(CategoryGroupSchema),
});

interface BudgetManageTableProps {
  onSubmit: (data: z.infer<typeof BudgetFormSchema>) => void;
}

const roundCurrency = (amount: number): number => {
  return Math.round(amount * 100) / 100;
};

export const BudgetManageTable = forwardRef<HTMLFormElement, BudgetManageTableProps>(
  ({ onSubmit }, ref) => {
    const { workspace } = useBudgetWorkspace();

    const supabase = getSupabaseBrowserClient();
    const categoryService = createCategoryService(supabase);

    const form = useForm<z.infer<typeof BudgetFormSchema>>({
      resolver: zodResolver(BudgetFormSchema),
      defaultValues: {
        categoryGroups: []
      },
    });

    useEffect(() => {
      async function initializeCategories() {
        const allCategories = await categoryService.getBudgetCategoryGroups(workspace.budget.id);
        const budgetSpendingRecommendationsBalanced = workspace.budget.spendingRecommendations.balanced || {};
        const budgetSpendingTrackingsByMonth = workspace.budget.spendingTracking || {};
        const currentMonth = Object.keys(budgetSpendingTrackingsByMonth)
          .sort()
          .pop() || new Date().toISOString().slice(0, 7); // Get the latest month in yyyy-MM format

        // Map and process all groups first
        const spendingGroups = Object.entries(allCategories).map(([groupName, group]) => {
          const groupTracking = budgetSpendingTrackingsByMonth[currentMonth]?.[group.name]
            ? {
              groupId: group.id,
              groupName: groupName,
              spending: budgetSpendingRecommendationsBalanced[groupName]?.spending ?? 0,
              recommendation: budgetSpendingRecommendationsBalanced[groupName]?.recommendation ?? 0,
              target: (budgetSpendingRecommendationsBalanced[groupName]?.recommendation ?? 0).toFixed(2),
              isTaxDeductible: budgetSpendingTrackingsByMonth[currentMonth][groupName]?.isTaxDeductible ?? false,
              targetSource: budgetSpendingTrackingsByMonth[currentMonth][groupName]?.targetSource ?? 'group' as const
            }
            : {
              groupId: group.id,
              groupName: group.name,
              spending: 0,
              recommendation: 0,
              target: "0.00",
              isTaxDeductible: false,
              targetSource: 'group' as const,
              categories: []
            };

          // Map all categories from allCategories, merging with existing spending data
          const categories = group.categories.map(category => {
            const groupRecommendationCategory = budgetSpendingRecommendationsBalanced?.[groupName]?.categories?.find(c => c.categoryName === category.name);
            return {
              id: category.id,
              categoryName: category.name,
              recommendation: groupRecommendationCategory?.recommendation ?? 0,
              spending: groupRecommendationCategory?.spending ?? 0,
              target: (groupRecommendationCategory?.recommendation ?? 0).toFixed(2),
              isTaxDeductible: false
            };
          });

          return {
            groupId: group.id,
            groupName: groupName,
            spending: groupTracking.spending,
            recommendation: groupTracking.recommendation,
            target: groupTracking.target,
            isTaxDeductible: groupTracking.isTaxDeductible,
            targetSource: groupTracking.targetSource,
            categories
          };
        });

        // Sort the groups according to the requirements
        const sortedSpendings = spendingGroups.sort((a, b) => {
          // Income group always comes first
          if (a.groupName === "Income") return -1;
          if (b.groupName === "Income") return 1;

          // Sort by spending (descending)
          const spendingDiff = Math.abs(b.spending) - Math.abs(a.spending);

          // If spending is equal, sort alphabetically
          if (spendingDiff === 0) {
            return a.groupName.localeCompare(b.groupName);
          }

          return spendingDiff;
        });

        form.reset({ categoryGroups: sortedSpendings });
      }
      initializeCategories();
    }, [workspace.budgetCategories]);

    const handleSubmit = (data: z.infer<typeof BudgetFormSchema>) => {
      onSubmit({ categoryGroups: data.categoryGroups });
    };

    const formatCurrency = (amount: string | number, currency: string = "USD"): string => {
      const numberAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numberAmount);
    };

    const toggleGroup = (groupName: string) => {
      const currentValues = form.getValues();
      const updatedGroups = currentValues.categoryGroups.map((group) => {
        if (group.groupName === groupName) {
          return {
            ...group,
            targetSource:
              group.targetSource === 'group' ? ('category' as const) : ('group' as const),
          };
        }
        return group;
      });
      form.reset({ categoryGroups: updatedGroups });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      if (newValue === '' || /^-?\d*\.?\d*$/.test(newValue)) {
        return newValue;
      }
      return e.target.defaultValue;
    };

    const handleInputBlur = (
      e: React.FocusEvent<HTMLInputElement>,
      isIncome: boolean,
    ) => {
      const numericValue = parseFloat(e.target.value.replace(/[^0-9.-]/g, ''));
      if (isNaN(numericValue)) return '0.00';

      const finalValue = roundCurrency(numericValue);

      if (isIncome && finalValue > 0) {
        return (-Math.abs(finalValue)).toFixed(2);
      } else if (!isIncome && finalValue < 0) {
        return Math.abs(finalValue).toFixed(2);
      }

      return finalValue.toFixed(2);
    };

    return (
      <Form {...form}>
        <form ref={ref} onSubmit={form.handleSubmit(handleSubmit)} className="w-full">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="grid grid-cols-12 p-4 gap-2">
                  <TableHead className="col-span-1 flex items-center justify-center text-center text-xs">Advanced Mode</TableHead>
                  <TableHead className="col-span-4 flex items-center justify-start pl-6">Category</TableHead>
                  <TableHead className="col-span-3">
                    <div className="flex flex-col items-center justify-center h-full v-full">
                      <div>Spending</div>
                      <div className="text-xs inline-flex flex-row gap-1 items-center">
                        (Current <ArrowRight className="h-4 w-4" /> Recommended)
                      </div>
                    </div>
                  </TableHead>
                  <TableHead className="col-span-3 flex items-center justify-center">
                    <div className="flex items-center justify-center gap-1 h-full text-center">
                      Budget Target
                    </div>
                  </TableHead>
                  <TableHead className="col-span-1 flex items-center justify-center">
                    <div className="flex items-center justify-center h-full text-center text-xs">
                      Tax Deductible
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {form.watch('categoryGroups').map((spending, groupIndex) => (
                  <React.Fragment key={spending.groupId}>
                    <TableRow className="grid grid-cols-12 px-4 gap-2">
                      <TableCell className="col-span-1 capitalize font-bold flex items-center justify-center">
                        <Switch
                          checked={spending.targetSource === 'category'}
                          onCheckedChange={() => toggleGroup(spending.groupName)}
                          disabled={!spending.categories?.length}
                          className={cn(
                            "data-[state=checked]:bg-primary",
                            !spending.categories?.length && "cursor-not-allowed opacity-50"
                          )}
                        />
                      </TableCell>
                      <TableCell className="col-span-4 pl-6 capitalize font-bold flex items-center">
                        <div className="flex items-center gap-2">
                          {spending.groupName}
                        </div>
                      </TableCell>
                      <TableCell className="col-span-3 font-bold flex items-center justify-center">
                        <div className="inline-flex flex-row gap-1 items-center justify-center w-full">
                          {formatCurrency(spending.spending!)}
                          <ArrowRight className="h-4 w-4" />
                          <span className={cn({
                            'text-red-500': spending.recommendation! < spending.spending!,
                            'text-green-500': spending.recommendation! > spending.spending!
                          })}>
                            {formatCurrency(spending.recommendation!)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="col-span-3 font-bold flex items-center justify-center relative">
                        <FormField
                          control={form.control}
                          name={`categoryGroups.${groupIndex}.target`}
                          render={({ field }) => (
                            <FormItem className="space-y-0">
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={spending.targetSource === 'category'}
                                  value={spending.targetSource === 'category'
                                    ? (spending.categories?.reduce((sum, cat, catIndex) => {
                                      const catTarget = parseFloat(form.watch(`categoryGroups.${groupIndex}.categories.${catIndex}.target`)) || 0;
                                      return sum + catTarget;
                                    }, 0) || 0).toFixed(2)
                                    : field.value
                                  }
                                  className={cn(
                                    "w-full text-right px-6",
                                    form.formState.errors.categoryGroups?.[groupIndex]?.target && "border-red-500",
                                    spending.targetSource === 'category' && "bg-muted"
                                  )}
                                  onChange={(e) => field.onChange(handleInputChange(e))}
                                  onBlur={(e) => field.onChange(handleInputBlur(e, spending.groupName === "Income"))}
                                />
                              </FormControl>
                              <FormMessage className="absolute text-xs bottom-1 left-0 right-0 text-center" />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell className="col-span-1 font-bold flex items-center justify-center">
                        <FormField
                          control={form.control}
                          name={`categoryGroups.${groupIndex}.isTaxDeductible`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <div className="flex items-center h-full w-full">
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    className="h-4 w-4 transition-none transform-none"
                                  />
                                </div>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </TableCell>
                    </TableRow>
                    {spending.targetSource === 'category' && spending.categories?.map((category, childIndex) => (
                      <TableRow key={`${spending.groupId}-${category.id}`} className="grid grid-cols-12 px-3">
                        <TableCell className="col-span-4 col-start-2 capitalize pl-10 flex items-center">
                          {category.categoryName}
                        </TableCell>
                        <TableCell className="col-span-3">
                          <div className="flex flex-row gap-1 items-center justify-center h-full w-full">
                            {formatCurrency(category.spending!)}
                            <ArrowRight className="h-4 w-4" />
                            <span className={cn({
                              'text-red-500': category.recommendation! < category.spending!,
                              'text-green-500': category.recommendation! > category.spending!
                            })}>
                              {formatCurrency(category.recommendation!)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className={cn(
                          "col-span-3 px-3 relative flex items-center justify-center",
                          form.formState.errors.categoryGroups?.[groupIndex]?.categories?.[childIndex]?.target && "pb-6"
                        )}>
                          <FormField
                            control={form.control}
                            name={`categoryGroups.${groupIndex}.categories.${childIndex}.target`}
                            render={({ field }) => (
                              <FormItem className="space-y-0 w-full px-8">
                                <FormControl>
                                  <Input
                                    {...field}
                                    disabled={spending.targetSource === 'group'}
                                    value={field.value}
                                    className={cn(
                                      "w-full text-right px-6",
                                      form.formState.errors.categoryGroups?.[groupIndex]?.categories?.[childIndex]?.target && "border-red-500",
                                      spending.targetSource === 'group' && "bg-muted"
                                    )}
                                    onChange={(e) => field.onChange(handleInputChange(e))}
                                    onBlur={(e) => field.onChange(handleInputBlur(e, category.categoryName === "Income"))}
                                  />
                                </FormControl>
                                <FormMessage className="absolute text-xs bottom-1 left-0 right-0 text-center" />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="col-span-1 font-bold flex items-center justify-center">
                          <FormField
                            control={form.control}
                            name={`categoryGroups.${groupIndex}.categories.${childIndex}.isTaxDeductible`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <div>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      className="h-4 w-4 transition-none transform-none"
                                    />
                                  </div>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </form>
      </Form>
    );
  }
);
