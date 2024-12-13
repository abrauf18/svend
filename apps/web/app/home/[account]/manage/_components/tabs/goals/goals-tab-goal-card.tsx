import { Card } from '@kit/ui/card';
import { cn } from '@kit/ui/utils';
import { useBudgetWorkspace } from '~/components/budget-workspace-context';
import { BudgetGoal } from '~/lib/model/budget.types';
import { FinAccount } from '~/lib/model/fin.types';
import { ArrowRight } from "lucide-react";
import { useState, useEffect } from 'react';
import { Progress } from '@kit/ui/progress';

interface GoalCardProps {
  goal: BudgetGoal;
}

type GoalStatus = {
  progressPercentage: number;
  status: 'way-behind' | 'behind' | 'on-track' | 'ahead' | 'way-ahead';
  currentBalance: number;
  projectedBalance: number;
  progressAmount: number;
};

type AllocationInfo = {
  lastAllocation: { date: Date; amount: number } | null;
  nextAllocation: { date: Date; amount: number } | null;
};

function calculateGoalProgress(goal: BudgetGoal, linkedAccounts: Array<FinAccount>): GoalStatus {
  const tracking = goal.spendingTracking;
  const currentDate = new Date();
  
  const linkedAccount = linkedAccounts.find(account => account.budgetFinAccountId === goal.budgetFinAccountId);
  if (!linkedAccount) {
    return { progressPercentage: 0, status: 'behind' as const, currentBalance: 0, projectedBalance: 0, progressAmount: 0 };
  }

  const currentBalance = linkedAccount.balance;
  
  const months = Object.keys(tracking).sort();
  if (months.length === 0) {
    return { progressPercentage: 0, status: 'behind' as const, currentBalance: 0, projectedBalance: 0, progressAmount: 0 };
  }

  const firstMonth = tracking[months[0]!]!;
  const startingBalance = firstMonth.startingBalance;

  // Calculate total allocations and allocations due by today
  let totalAllocations = 0;
  let allocationsDueByToday = 0;
  let projectedBalance = startingBalance;

  for (const month of months) {
    const monthlyTracking = tracking[month]!;
    Object.values(monthlyTracking.allocations).forEach((allocation) => {
      const allocationDate = new Date(allocation.dateTarget);
      totalAllocations += allocation.amountTarget;
      
      if (allocationDate <= currentDate) {
        allocationsDueByToday += allocation.amountTarget;
        projectedBalance += allocation.amountTarget;
      }
    });
  }

  const totalMonths = months.length;
  const averageMonthlyAllocation = totalAllocations / totalMonths;

  if (goal.type === 'savings') {
    console.log('Savings goal allocation check:', {
      allocationsDueByToday,
      averageMonthlyAllocation
    });
  }

  // Calculate progress based on goal type
  let progressPercentage: number;
  let difference: number;
  let progressAmount: number;

  if (goal.type === 'debt') {
    progressAmount = startingBalance - currentBalance;
    progressPercentage = (progressAmount / goal.amount) * 100;
    difference = projectedBalance - currentBalance;
  } else {
    // For investment/savings:
    // Progress amount is simply how much we've gained since starting
    progressAmount = currentBalance - startingBalance;
    // Progress percentage is how much of our goal amount we've achieved
    progressPercentage = (progressAmount / goal.amount) * 100;
    difference = currentBalance - projectedBalance;
  }

  // Determine status
  let status: GoalStatus['status'] = 'on-track';
  
  if (allocationsDueByToday === 0) {
    // Nothing due yet - can only be ahead or way-ahead
    if (difference > averageMonthlyAllocation * 1.5) {
      status = 'way-ahead';
    } else if (difference > averageMonthlyAllocation * 0.5) {
      status = 'ahead';
    }
  } else {
    const amountBehind = projectedBalance - currentBalance;
    
    if (amountBehind > averageMonthlyAllocation * 1.5) {
      status = 'way-behind';
    } else if (amountBehind > averageMonthlyAllocation * 0.5) {
      status = 'behind';
    } else if (difference > averageMonthlyAllocation * 1.5) {
      status = 'way-ahead';
    } else if (difference > averageMonthlyAllocation * 0.5) {
      status = 'ahead';
    }
  }

  return { progressPercentage, status, currentBalance, projectedBalance, progressAmount };
}

function findRelevantAllocations(goal: BudgetGoal) {
  const currentDate = new Date();
  let lastAllocation: { date: Date; amount: number } | null = null;
  let nextAllocation: { date: Date; amount: number } | null = null;

  // Sort months chronologically
  const months = Object.keys(goal.spendingTracking).sort();
  
  // Flatten all allocations into a single array with dates
  const allAllocations = months.flatMap(month => {
    const monthlyTracking = goal.spendingTracking[month]!;
    return Object.values(monthlyTracking.allocations).map(allocation => ({
      date: new Date(allocation.dateTarget),
      amount: allocation.amountTarget
    }));
  }).sort((a, b) => a.date.getTime() - b.date.getTime());

  // Find last and next allocations relative to current date
  for (const allocation of allAllocations) {
    if (allocation.date <= currentDate) {
      lastAllocation = allocation;
    } else {
      nextAllocation = allocation;
      break;
    }
  }

  return { lastAllocation, nextAllocation };
}

export function GoalCard({ goal }: GoalCardProps) {
  const { workspace } = useBudgetWorkspace();
  const [goalStatus, setGoalStatus] = useState<GoalStatus>({
    progressPercentage: 0,
    status: 'on-track',
    currentBalance: 0,
    projectedBalance: 0,
    progressAmount: 0
  });
  const [allocations, setAllocations] = useState<AllocationInfo>({
    lastAllocation: null,
    nextAllocation: null
  });

  useEffect(() => {
    const result = calculateGoalProgress(goal, workspace.budget.linkedFinAccounts);
    setGoalStatus(result);
    
    // Find allocations and update state
    const allocationInfo = findRelevantAllocations(goal);
    setAllocations(allocationInfo);
  }, [goal, workspace.budget.linkedFinAccounts]);

  const difference = goalStatus.currentBalance - goalStatus.projectedBalance;

  const getStatusText = () => {
    switch (goalStatus.status) {
      case 'way-behind':
        return 'Way Behind';
      case 'behind':
        return 'Behind';
      case 'on-track':
        return 'On Track';
      case 'ahead':
        return 'Ahead';
      case 'way-ahead':
        return 'Way Ahead';
      default:
        return 'On Track';
    }
  };

  return (
    <Card className="flex flex-col bg-background p-4 shadow-sm">
      {/* Top Section - Header with Status */}
      <div className="flex items-start justify-between mb-6">
        <div className="space-y-0.5">
          <div className="text-xs text-muted-foreground">{goal.type.charAt(0).toUpperCase() + goal.type.slice(1)}</div>
          <h3 className="text-sm font-semibold text-foreground">{goal.name}</h3>
        </div>
        
        <div className="flex flex-col items-end gap-0.5 min-h-[52px]">
          <div className={cn(
            "inline-flex items-center rounded px-2 py-2",
            goalStatus.status === 'way-behind' && "bg-red-500/10 dark:bg-red-500/20",
            goalStatus.status === 'behind' && "bg-orange-600/10 dark:bg-orange-600/20",
            goalStatus.status === 'on-track' && "bg-muted",
            goalStatus.status === 'ahead' && "bg-green-400/10 dark:bg-green-400/20",
            goalStatus.status === 'way-ahead' && "bg-green-600/10 dark:bg-green-600/20"
          )}>
            <div className={cn(
              "text-sm",
              goalStatus.status === 'way-behind' && "text-red-600 dark:text-red-400",
              goalStatus.status === 'behind' && "text-orange-600 dark:text-orange-500",
              goalStatus.status === 'on-track' && "text-muted-foreground",
              goalStatus.status === 'ahead' && "text-green-500 dark:text-green-400",
              goalStatus.status === 'way-ahead' && "text-green-700 dark:text-green-300"
            )}>
              {getStatusText()}
            </div>
          </div>

          {difference !== 0 ? (
            <div className={cn(
              "text-xs pr-[2px]",
              goalStatus.status === 'way-behind' && "text-red-600 dark:text-red-400",
              goalStatus.status === 'behind' && "text-orange-600 dark:text-orange-500",
              goalStatus.status === 'on-track' && "text-muted-foreground",
              goalStatus.status === 'ahead' && "text-green-500 dark:text-green-400",
              goalStatus.status === 'way-ahead' && "text-green-700 dark:text-green-300"
            )}>
              {goalStatus.status === 'way-behind' || goalStatus.status === 'behind'
                ? `(${formatCurrency(Math.abs(difference))})`
                : goalStatus.status === 'on-track'
                  ? difference > 0
                    ? `+${formatCurrency(Math.abs(difference))}`
                    : `(${formatCurrency(Math.abs(difference))})`
                  : `+${formatCurrency(Math.abs(difference))}`}
            </div>
          ) : (
            <div className="text-xs">&nbsp;</div>
          )}
        </div>
      </div>

      {/* Middle Section - Scheduled Allocations */}
      <div className="flex flex-col justify-center pb-8">
        <div className="flex flex-col gap-0.5">
          <div className="text-xs">
            <h3 className="text-muted-foreground underline">Allocations</h3>
            <span className="text-muted-foreground font-bold">Last: </span>
            {allocations.lastAllocation ? (
              <span>{formatCurrency(allocations.lastAllocation.amount)} on {allocations.lastAllocation.date.toLocaleDateString()}</span>
            ) : (
              <span className="text-muted-foreground">None</span>
            )}
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground font-bold">Next: </span>
            {allocations.nextAllocation ? (
              <span>{formatCurrency(allocations.nextAllocation.amount)} on {allocations.nextAllocation.date.toLocaleDateString()}</span>
            ) : (
              <span className="text-muted-foreground">None scheduled</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Bottom Section - All Progress Information */}
      <div className="space-y-3">
        <div className="flex justify-between px-1">
          <div className="text-xs">
            <span className="font-medium text-foreground">
              {formatCurrency(goalStatus.progressAmount)}
            </span>
            <span className="text-muted-foreground ml-1">
              progress
            </span>
          </div>
          <div className="text-xs">
            <span className="font-medium text-foreground">
              {formatCurrency(goal.amount)}
            </span>
            <span className="text-muted-foreground ml-1">
              goal
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Progress 
            value={Math.min(100, Math.max(0, goalStatus.progressPercentage))}
            className={cn(
              "flex-grow",
              goalStatus.status === 'way-behind' && "[&>div]:bg-red-500",
              goalStatus.status === 'behind' && "[&>div]:bg-orange-800",
              goalStatus.status === 'on-track' && "[&>div]:bg-primary",
              goalStatus.status === 'ahead' && "[&>div]:bg-green-400",
              goalStatus.status === 'way-ahead' && "[&>div]:bg-green-600"
            )}
          />
          <div className="text-sm font-bold">
            {Math.round(Math.min(100, goalStatus.progressPercentage))}%
          </div>
        </div>
      </div>
    </Card>
  );
}

const formatCurrency = (amount: number, currency: string = "USD"): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};
