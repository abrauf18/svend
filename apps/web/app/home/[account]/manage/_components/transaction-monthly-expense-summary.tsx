import React from 'react';
import { Progress } from '@kit/ui/progress';
import { cn } from '@kit/ui/utils';
import { useBudgetWorkspace } from '~/components/budget-workspace-context';
import { BudgetSpendingCategoryGroupTracking } from '~/lib/model/budget.types';
import { BarChart3, Infinity } from 'lucide-react';

// Reuse the same helper functions from budget-manage-table
const calculateProgressBar = (actual: number, target: number): number => {
  if (actual === 0) return 0;
  if (target === 0) return 100;
  return Math.min((Math.abs(actual) / Math.abs(target)) * 100, 100);
};

const calculateProgressPercentage = (actual: number, target: number): number => {
  if (target === 0) return 100;
  return (Math.abs(actual) / Math.abs(target)) * 100;
};

const calculateMonthlyPace = (selectedDate: Date): number => {
  const today = new Date();
  const isCurrentMonth = selectedDate.getMonth() === today.getMonth() 
    && selectedDate.getFullYear() === today.getFullYear();

  if (isCurrentMonth) {
    return (today.getDate() / new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()) * 100;
  }
  return 100;
};

const getProgressBarColors = (actual: number, target: number, monthlyPace: number, isIncome: boolean) => {
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

const getEffectiveSpending = (group: BudgetSpendingCategoryGroupTracking): { actual: number; target: number } => {
  const result = group.targetSource === 'category' 
    ? {
        actual: group.categories.reduce((sum, cat) => sum + cat.spendingActual, 0),
        target: group.categories.reduce((sum, cat) => sum + cat.spendingTarget, 0)
      }
    : {
        actual: group.spendingActual,
        target: group.spendingTarget
      };

  return result;
};

// Add selectedDate to props
interface TransactionMonthlyExpenseSummaryProps {
    selectedDate: Date;
}

// Update getProgressDisplay helper function
const getProgressDisplay = (actual: number, target: number): React.ReactNode => {
  if (actual === 0) return "0%";
  if (target === 0) return <Infinity className="h-3 w-3" />;
  
  const percentage = Math.round((Math.abs(actual) / Math.abs(target)) * 100);
  if (percentage > 1000) return ">1000%";
  return `${percentage}%`;
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
  }).format(Math.abs(amount));
};

function TransactionMonthlyExpenseSummary({ selectedDate }: TransactionMonthlyExpenseSummaryProps) {
    const { workspace } = useBudgetWorkspace();
    const currentMonth = selectedDate.toISOString().slice(0, 7);
    
    const monthlyTracking = workspace.budget.spendingTracking[currentMonth] || {};
    
    // Get all non-income groups and sort by actual spending, then by target spending
    const expenseGroups = Object.values(monthlyTracking)
        .filter(group => group.groupName !== 'Income')
        .map(group => ({
            ...group,
            effectiveSpending: getEffectiveSpending(group)
        }))
        .sort((a, b) => {
            const actualDiff = Math.abs(b.effectiveSpending.actual) - Math.abs(a.effectiveSpending.actual);
            // If actual spending is equal, sort by target spending
            return actualDiff !== 0 ? actualDiff : Math.abs(b.effectiveSpending.target) - Math.abs(a.effectiveSpending.target);
        });

    // Take top 5 expense groups
    const topExpenseGroups = expenseGroups.slice(0, 5);

    // Calculate totals across ALL expense groups (not just top 5)
    const totalActual = expenseGroups.reduce((sum, group) => 
        sum + Math.abs(group.effectiveSpending.actual), 0);
    const totalTarget = expenseGroups.reduce((sum, group) => 
        sum + Math.abs(group.effectiveSpending.target), 0);

    return (
        <div className="bg-white p-4 rounded-lg shadow-lg">
            {/* Progress Overview Section */}
            <div className="text-center mb-4 p-4 rounded-lg bg-white dark:bg-gray-900">
                <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-full inline-block">
                    <BarChart3 className="w-6 h-6 text-gray-900 dark:text-white" />
                </div>
                <p className="mt-2 text-[16px] font-bold text-gray-900 dark:text-white">Check Your Spending</p>
                <p className="text-[14px] text-gray-500 dark:text-gray-300">Monthly expense summary</p>
            </div>

            {/* Top Expenses Overview */}
            <div className="p-4 rounded-lg border border-gray-200 bg-white dark:bg-gray-900">
                <h3 className="text-[16px] text-center font-bold text-gray-800 dark:text-white mb-4">
                  {selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h3>
                <div className="space-y-4">
                    {topExpenseGroups.map((group) => (
                        <div key={group.groupName}>
                            <div className="flex justify-between text-xs">
                                <span className="font-medium">{group.groupName}</span>
                                <span className="font-bold">{formatCurrency(group.effectiveSpending.actual)}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <Progress 
                                    value={calculateProgressBar(
                                        group.effectiveSpending.actual,
                                        group.effectiveSpending.target
                                    )}
                                    className={cn(
                                        "flex-grow",
                                        getProgressBarColors(
                                            group.effectiveSpending.actual,
                                            group.effectiveSpending.target,
                                            calculateMonthlyPace(selectedDate),
                                            group.groupName === 'Income'
                                        )
                                    )}
                                />
                                <span className="text-xs text-muted-foreground flex items-center min-w-[48px] justify-end">
                                    {getProgressDisplay(
                                        group.effectiveSpending.actual,
                                        group.effectiveSpending.target
                                    )}
                                </span>
                            </div>
                        </div>
                    ))}

                    {/* Monthly Totals */}
                    <div className="pt-4 border-t border-gray-200">
                        <div className="flex text-sm font-bold justify-between text-gray-700 dark:text-white">
                            <span>Total</span>
                            <span>{formatCurrency(totalActual)}</span>
                        </div>
                        <div className="flex text-xs justify-between text-gray-700 dark:text-white">
                            <span>Budget</span>
                            <span>{formatCurrency(totalTarget)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <Progress 
                                value={calculateProgressBar(totalActual, totalTarget)}
                                className={cn(
                                    "flex-grow",
                                    getProgressBarColors(
                                        totalActual,
                                        totalTarget,
                                        calculateMonthlyPace(selectedDate),
                                        workspace.budget.spendingTracking[currentMonth]?.Income?.groupName === 'Income'
                                    )
                                )}
                            />
                            <span className="text-xs text-muted-foreground flex items-center min-w-[48px] justify-end">
                                {getProgressDisplay(totalActual, totalTarget)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TransactionMonthlyExpenseSummary;
