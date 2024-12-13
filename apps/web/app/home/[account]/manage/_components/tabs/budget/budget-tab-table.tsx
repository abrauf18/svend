'use client';

import React, { forwardRef, use, useEffect, useState } from 'react';
import { ArrowRight, Save, Infinity } from 'lucide-react';

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
import { Progress } from '@kit/ui/progress';
import { Button } from '@kit/ui/button';

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
  selectedDate: Date;
  onDirtyStateChange: (isDirty: boolean) => void;
}

const roundCurrency = (amount: number): number => {
  return Math.round(amount * 100) / 100;
};

const calculateProgressBar = (actual: number, target: number): number => {
  if (actual === 0) return 0;
  if (target === 0) return 100;
  return Math.min((Math.abs(actual) / Math.abs(target)) * 100, 100);
};

const calculateProgressPercentage = (actual: number, target: number): number => {
  if (target === 0) return 100;
  return (Math.abs(actual) / Math.abs(target)) * 100;
};

// Helper function to get the effective target value
const getEffectiveTarget = (group: any, asNumber: boolean = false): string | number => {
  if (group.targetSource === 'category') {
    const sum = group.categories.reduce((sum: number, cat: any) => 
      sum + parseFloat(cat.target || '0'), 0
    );
    return asNumber ? sum : sum.toFixed(2);
  }
  return asNumber ? parseFloat(group.target || '0') : group.target;
};

// Add this helper function near the top with other utility functions
const calculateMonthlyPace = (selectedDate: Date): number => {
  const today = new Date();
  const isCurrentMonth = selectedDate.getMonth() === today.getMonth() 
    && selectedDate.getFullYear() === today.getFullYear();

  if (isCurrentMonth) {
    // For current month, use today's date
    return (today.getDate() / new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()) * 100;
  } else {
    // For past months, use 100%
    return 100;
  }
};

// Update the getProgressBarColors function to handle income differently
const getProgressBarColors = (
  actual: number, 
  target: number, 
  monthlyPace: number,
  isIncome: boolean
) => {
  const progressPercentage = calculateProgressPercentage(actual, target);
  
  if (isIncome) {
    // For income: over pace is good (green), under pace is bad (red)
    if (progressPercentage > monthlyPace + 10) return "[&>div]:bg-green-500";
    if (progressPercentage < monthlyPace - 10) return "[&>div]:bg-red-500";
  } else {
    // For expenses: over pace is bad (red), under pace is good (green)
    if (progressPercentage > monthlyPace + 10) return "[&>div]:bg-red-500";
    if (progressPercentage < monthlyPace - 10) return "[&>div]:bg-green-500";
  }
  return "[&>div]:bg-primary";
};

// Update the formatCurrency function to handle accounting style
const formatCurrency = (amount: string | number, isIncome: boolean = false): string => {
  const numberAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  const absAmount = Math.abs(numberAmount);
  
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absAmount);

  return isIncome && numberAmount !== 0 ? `(${formatted})` : formatted;
};

// Helper function to ensure we get a number
const getNumericTarget = (group: any): number => {
  const target = getEffectiveTarget(group, true);
  return typeof target === 'string' ? parseFloat(target) : target;
};

export const BudgetManageTable = forwardRef<HTMLFormElement, BudgetManageTableProps>(
  ({ onSubmit, selectedDate, onDirtyStateChange }, ref) => {
    const { workspace } = useBudgetWorkspace();

    const supabase = getSupabaseBrowserClient();
    const categoryService = createCategoryService(supabase);

    const form = useForm<z.infer<typeof BudgetFormSchema>>({
      resolver: zodResolver(BudgetFormSchema),
      defaultValues: {
        categoryGroups: []
      },
    });

    // Watch for any form changes
    useEffect(() => {
      const subscription = form.watch(() => {
        // Track both form state and manual changes
        onDirtyStateChange(true);
      });
      return () => subscription.unsubscribe();
    }, [form, form.watch, onDirtyStateChange]);

    // Reset dirty state when form is initialized
    useEffect(() => {
      async function initializeCategories() {
        const allCategories = await categoryService.getBudgetCategoryGroups(workspace.budget.id);
        const budgetSpendingTrackingsByMonth = workspace.budget.spendingTracking || {};
        const selectedMonth = selectedDate.toISOString().slice(0, 7); // Format: YYYY-MM
        const currentMonthTracking = budgetSpendingTrackingsByMonth[selectedMonth] || {};

        // Map and process all groups
        const spendingGroups = Object.entries(allCategories).map(([groupName, group]) => {
          const groupTracking = currentMonthTracking[groupName] || {
            spendingActual: 0,
            spendingTarget: 0,
            isTaxDeductible: false,
            targetSource: 'group' as const,
            categories: []
          };

          // Map all categories from allCategories, merging with tracking data
          const categories = group.categories.map(category => {
            const categoryTracking = groupTracking.categories?.find(
              c => c.categoryName === category.name
            ) || {
              spendingActual: 0,
              spendingTarget: 0,
              isTaxDeductible: false
            };

            return {
              id: category.id,
              categoryName: category.name,
              spending: categoryTracking.spendingActual,
              target: categoryTracking.spendingTarget.toFixed(2),
              isTaxDeductible: categoryTracking.isTaxDeductible
            };
          });

          return {
            groupId: group.id,
            groupName: groupName,
            spending: groupTracking.spendingActual,
            target: groupTracking.spendingTarget.toFixed(2),
            isTaxDeductible: groupTracking.isTaxDeductible,
            targetSource: groupTracking.targetSource,
            categories
          };
        });

        // Sort the groups according to the requirements
        const sortedSpendings = spendingGroups.sort((a, b) => {
          if (a.groupName === "Income") return -1;
          if (b.groupName === "Income") return 1;
          const spendingDiff = Math.abs(b.spending) - Math.abs(a.spending);
          return spendingDiff === 0 ? a.groupName.localeCompare(b.groupName) : spendingDiff;
        });

        form.reset({ categoryGroups: sortedSpendings });
        onDirtyStateChange(false);
      }
      initializeCategories();
    }, [workspace.budget.spendingTracking, workspace.budgetCategories, selectedDate, onDirtyStateChange]);

    // Add useEffect to watch selectedDate changes
    useEffect(() => {
      const monthlyPace = calculateMonthlyPace(selectedDate);
      // Force a re-render when the date changes
      form.trigger();
    }, [selectedDate, form]);

    const handleSubmit = (data: z.infer<typeof BudgetFormSchema>) => {
      onSubmit({ categoryGroups: data.categoryGroups });
    };

    const toggleGroup = (groupName: string) => {
      const currentValues = form.getValues();
      const groupIndex = currentValues.categoryGroups.findIndex(g => g.groupName === groupName);
      
      if (groupIndex === -1) return;

      // Set the new value and mark as dirty immediately
      form.setValue(
        `categoryGroups.${groupIndex}.targetSource`,
        currentValues.categoryGroups[groupIndex]!.targetSource === 'group' ? 'category' : 'group'
      );
      onDirtyStateChange(true);
    };

    const handleInputChange = (
      e: React.ChangeEvent<HTMLInputElement>,
      groupIndex: number,
      categoryIndex?: number
    ) => {
      const newValue = e.target.value;
      
      // Allow empty input and negative sign for typing
      if (newValue === '' || newValue === '-') {
        setEditingTarget(prev => prev ? { ...prev, tempValue: newValue } : null);
        return;
      }
      
      // Check for valid number format with max 2 decimal places
      if (!/^-?\d*\.?\d{0,2}$/.test(newValue)) {
        return;
      }

      setEditingTarget(prev => prev ? { ...prev, tempValue: newValue } : null);
    };

    const handleInputBlur = (
      e: React.FocusEvent<HTMLInputElement>,
      groupIndex: number,
      categoryIndex?: number
    ) => {
      const numericValue = parseFloat(e.target.value.replace(/[^0-9.-]/g, ''));
      let finalValue = isNaN(numericValue) ? 0 : roundCurrency(numericValue);
      
      // Get the group name to check if it's an income group
      const groupName = form.getValues(`categoryGroups.${groupIndex}.groupName`);
      const isIncome = groupName === "Income";

      // Enforce negative values for income and positive for expenses
      if (isIncome && finalValue > 0) {
        finalValue = -finalValue;
      } else if (!isIncome && finalValue < 0) {
        finalValue = Math.abs(finalValue);
      }

      const formattedValue = finalValue.toFixed(2);
      
      // Update both form and committed values
      const key = categoryIndex !== undefined 
        ? `${groupIndex}-${categoryIndex}` 
        : `${groupIndex}`;
      
      setCommittedValues(prev => ({
        ...prev,
        [key]: formattedValue
      }));

      if (categoryIndex !== undefined) {
        form.setValue(`categoryGroups.${groupIndex}.categories.${categoryIndex}.target`, formattedValue);
      } else {
        form.setValue(`categoryGroups.${groupIndex}.target`, formattedValue);
      }

      setEditingTarget(null);
    };

    // Add state for tracking actively editing inputs
    const [editingTarget, setEditingTarget] = useState<{
      groupIndex?: number;
      categoryIndex?: number;
      tempValue: string;
    } | null>(null);

    // Add state for progress calculation values
    const [progressTargets, setProgressTargets] = useState<{
      [key: string]: string;
    }>({});

    // Add state for committed values used in progress calculations
    const [committedValues, setCommittedValues] = useState<{
      [key: string]: string;
    }>({});

    // Update initial values when form is reset
    useEffect(() => {
      const subscription = form.watch((value) => {
        if (!editingTarget) {  // Only update committed values when not editing
          const newCommittedValues: { [key: string]: string } = {};
          value.categoryGroups?.forEach((group, groupIndex) => {
            if (group) { // Check if group exists
              newCommittedValues[`${groupIndex}`] = group.target ?? '0.00';
              group.categories?.forEach((cat, catIndex) => {
                if (cat) { // Check if category exists
                  newCommittedValues[`${groupIndex}-${catIndex}`] = cat.target ?? '0.00';
                }
              });
            }
          });
          setCommittedValues(newCommittedValues);
        }
      });
      return () => subscription.unsubscribe();
    }, [form.watch]);

    // Get the committed value for progress calculations
    const getCommittedValue = (groupIndex: number, categoryIndex?: number) => {
      const key = categoryIndex !== undefined 
        ? `${groupIndex}-${categoryIndex}` 
        : `${groupIndex}`;
      return committedValues[key] || '0.00';
    };

    // Helper to get the display target value (for input field)
    const getDisplayTarget = (groupIndex: number, categoryIndex?: number) => {
      if (editingTarget && 
          editingTarget.groupIndex === groupIndex && 
          editingTarget.categoryIndex === categoryIndex) {
        return editingTarget.tempValue;
      }
      
      if (categoryIndex !== undefined) {
        return form.watch(`categoryGroups.${groupIndex}.categories.${categoryIndex}.target`);
      }
      return form.watch(`categoryGroups.${groupIndex}.target`);
    };

    // Helper to get the progress calculation target value
    const getProgressTarget = (groupIndex: number, categoryIndex?: number) => {
      const key = categoryIndex !== undefined 
        ? `${groupIndex}-${categoryIndex}` 
        : `${groupIndex}`;
      return progressTargets[key] || getDisplayTarget(groupIndex, categoryIndex);
    };

    const getProgressDisplay = (actual: number, target: number): React.ReactNode => {
      if (actual === 0) return "0%";
      if (target === 0) return <Infinity className="h-4 w-4" />;
      
      const percentage = Math.round((Math.abs(actual) / Math.abs(target)) * 100);
      if (percentage > 1000) return ">1000%";
      return `${percentage}%`;
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
                    <div className="flex items-center justify-center">
                      <div>Spending</div>
                    </div>
                    <div className="flex items-center justify-between h-8 px-6 w-full">
                      <div className="text-xs text-muted-foreground text-center">
                        Actual
                      </div>
                      <div className="text-xs text-muted-foreground text-center">
                        Target
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
                      <TableCell className="col-span-3">
                        <div className="flex flex-col gap-1 px-2 py-1">
                          <div className="flex justify-between">
                            <span className="text-sm font-bold pt-1">
                              {formatCurrency(spending.spending!, spending.groupName === "Income")}
                            </span>
                            <span className="text-xs font-normal pt-[6px]">
                              {formatCurrency(getEffectiveTarget(spending), spending.groupName === "Income")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 py-1">
                            <Progress 
                              value={calculateProgressBar(
                                spending.spending!, 
                                spending.targetSource === 'category' 
                                  ? getNumericTarget(spending)
                                  : parseFloat(getCommittedValue(groupIndex))
                              )}
                              className={cn(
                                "flex-grow",
                                getProgressBarColors(
                                  spending.spending!, 
                                  spending.targetSource === 'category' 
                                    ? getNumericTarget(spending)
                                    : parseFloat(getCommittedValue(groupIndex)),
                                  calculateMonthlyPace(selectedDate),
                                  spending.groupName === "Income"
                                )
                              )}
                            />
                            <span className="text-xs text-muted-foreground flex items-center min-w-[48px] justify-end">
                              {getProgressDisplay(
                                spending.spending!, 
                                spending.targetSource === 'category' 
                                  ? getNumericTarget(spending)
                                  : parseFloat(getCommittedValue(groupIndex))
                              )}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="col-span-3 flex items-center justify-center relative">
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
                                    ? getEffectiveTarget(spending) 
                                    : getDisplayTarget(groupIndex)}
                                  className={cn(
                                    "w-full text-right px-6 text-sm",
                                    form.formState.errors.categoryGroups?.[groupIndex]?.target && "border-red-500",
                                    spending.targetSource === 'category' && "bg-muted"
                                  )}
                                  onFocus={(e) => {
                                    setEditingTarget({
                                      groupIndex,
                                      tempValue: e.target.value
                                    });
                                  }}
                                  onChange={(e) => handleInputChange(e, groupIndex)}
                                  onBlur={(e) => handleInputBlur(e, groupIndex)}
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
                        <TableCell className="col-span-3 pl-6">
                          <div className="flex flex-col gap-1 px-3 py-1">
                            <div className="flex justify-between">
                              <span className="text-sm font-bold pt-1">
                                {formatCurrency(category.spending!, spending.groupName === "Income")}
                              </span>
                              <span className="text-xs font-normal pt-[6px]">
                                {formatCurrency(category.target!, spending.groupName === "Income")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={calculateProgressBar(
                                  category.spending!, 
                                  parseFloat(getCommittedValue(groupIndex, childIndex))
                                )}
                                className={cn(
                                  "flex-grow",
                                  getProgressBarColors(
                                    category.spending!, 
                                    parseFloat(getCommittedValue(groupIndex, childIndex)), 
                                    calculateMonthlyPace(selectedDate),
                                    spending.groupName === "Income" // Pass isIncome flag
                                  )
                                )}
                              />
                              <span className="text-xs text-muted-foreground flex items-center min-w-[48px] justify-end">
                                {getProgressDisplay(
                                  category.spending!, 
                                  parseFloat(getCommittedValue(groupIndex, childIndex))
                                )}
                              </span>
                            </div>
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
                              <FormItem className="space-y-0 w-full px-10">
                                <FormControl>
                                  <Input
                                    {...field}
                                    disabled={spending.targetSource === 'group'}
                                    value={getDisplayTarget(groupIndex, childIndex)}
                                    className={cn(
                                      "w-full text-right px-6 text-xs",
                                      form.formState.errors.categoryGroups?.[groupIndex]?.categories?.[childIndex]?.target && "border-red-500",
                                      spending.targetSource === 'group' && "bg-muted"
                                    )}
                                    onFocus={(e) => {
                                      setEditingTarget({
                                        groupIndex,
                                        categoryIndex: childIndex,
                                        tempValue: e.target.value
                                      });
                                    }}
                                    onChange={(e) => handleInputChange(e, groupIndex, childIndex)}
                                    onBlur={(e) => handleInputBlur(e, groupIndex, childIndex)}
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
