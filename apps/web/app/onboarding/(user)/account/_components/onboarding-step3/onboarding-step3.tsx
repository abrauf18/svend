import React, { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@kit/ui/card';
import { Progress } from '@kit/ui/progress';
import { Trans } from '@kit/ui/trans';
import { Button } from '@kit/ui/button';
import { BudgetTable } from "./budget-table";
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import type { BudgetFormSchema } from './budget-table';
import { LoadingOverlay } from '@kit/ui/loading-overlay';
import { useOnboardingContext } from '~/components/onboarding-context';
import { RecommendationCardDiscretionary, type DiscretionarySavingsRecommendation } from "./recommendation-card-discretionary";
import { RecommendationCardGoalTimeline, type GoalTimelineRecommendation } from "./recommendation-card-goaltimeline";
import { BudgetGoal } from '~/lib/model/budget.types';

function OnboardingStep3CreateBudget() {
  const [isLoading, setIsLoading] = useState(false);
  const [discretionarySavings, setDiscretionarySavings] = useState<DiscretionarySavingsRecommendation | null>(null);
  const [goalTimeline, setGoalTimeline] = useState<GoalTimelineRecommendation | null>(null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const { state } = useOnboardingContext();

  useEffect(() => {
    function calculateDiscretionarySavings() {
      const budgetSpendingRecommendationsBalanced = state.account.budget?.spendingRecommendations.balanced || {};

      // Calculate total discretionary spending by looking at each category within groups
      const currentSpending = Object.values(budgetSpendingRecommendationsBalanced)
        .reduce((total, group) => {
          // Sum up spending for discretionary categories within this group
          const groupDiscretionarySpending = group.categories
            .filter(category => {
              const categoryConfig = Object.values(state?.account.svendCategoryGroups || {})
                .flatMap(g => g.categories)
                .find(c => c.name === category.categoryName);
              return categoryConfig?.isDiscretionary || false;
            })
            .reduce((categoryTotal, category) => {
              return categoryTotal + Math.abs(category.spending || 0);
            }, 0);

          return total + groupDiscretionarySpending;
        }, 0);

      setDiscretionarySavings({
        currentSpending,
        potentialSavings: currentSpending * 0.5 // 50% reduction
      });

      return currentSpending * 0.5; // Return potential savings for use in timeline calculation
    }

    function calculateGoalTimeline() {
      const goals = state.account.budget?.goals || [];
      if (goals.length === 0) return;

      // Find the goal with the highest amount that has recommendations in both strategies
      const goalWithRecommendations = goals
        .filter(goal => {
          const conservativeRecs = goal.spendingRecommendations?.conservative;
          const balancedRecs = goal.spendingRecommendations?.balanced;
          return conservativeRecs && balancedRecs;
        })
        .reduce((highest, current) => 
          !highest || current.amount > highest.amount ? current : highest
        , null as BudgetGoal | null);

      if (!goalWithRecommendations) return;

      // Get the monthly recommendations for both strategies
      const conservativeRecs = goalWithRecommendations.spendingRecommendations.conservative;
      const balancedRecs = goalWithRecommendations.spendingRecommendations.balanced;

      // Compare number of allocation months between strategies
      const balancedMonths = Object.keys(balancedRecs?.monthlyAmounts || {}).length;
      const conservativeMonths = Object.keys(conservativeRecs?.monthlyAmounts || {}).length;

      // Calculate income and spending for both strategies
      const balancedIncome = Math.abs(state.account.budget?.spendingRecommendations.balanced?.['Income']?.recommendation || 0);
      const balancedSpending = Object.values(state.account.budget?.spendingRecommendations.balanced || {})
        .filter(group => group.groupName !== 'Income')
        .reduce((total, group) => total + group.recommendation, 0);
      
      const conservativeIncome = Math.abs(state.account.budget?.spendingRecommendations.conservative?.['Income']?.recommendation || 0);
      const conservativeSpending = Object.values(state.account.budget?.spendingRecommendations.conservative || {})
        .filter(group => group.groupName !== 'Income')
        .reduce((total, group) => total + group.recommendation, 0);
      
      // Calculate total monthly allocations for all goals
      const balancedGoalAllocations = Object.values(state.account.budget?.goals || [])
        .reduce((total, goal) => {
          const monthlyAmounts = Object.values(goal.spendingRecommendations.balanced.monthlyAmounts || {});
          return total + (monthlyAmounts.length > 0 ? monthlyAmounts.reduce((sum, amount) => sum + amount, 0) / monthlyAmounts.length : 0);
        }, 0);

      const conservativeGoalAllocations = Object.values(state.account.budget?.goals || [])
        .reduce((total, goal) => {
          const monthlyAmounts = Object.values(goal.spendingRecommendations.conservative.monthlyAmounts || {});
          return total + (monthlyAmounts.length > 0 ? monthlyAmounts.reduce((sum, amount) => sum + amount, 0) / monthlyAmounts.length : 0);
        }, 0);

      // Only proceed if conservative strategy results in fewer months
      if (conservativeMonths >= balancedMonths) return;

      const monthlySpendingReduction = Math.abs(balancedSpending - conservativeSpending);

      const availableFunds = balancedIncome - Math.abs(balancedSpending);
      const isSpendingReductionNeeded = availableFunds < conservativeGoalAllocations;

      setGoalTimeline({
        currentTimeline: balancedMonths,
        adjustedTimeline: conservativeMonths,
        monthlyAdjustment: monthlySpendingReduction,
        requiresSpendingReduction: isSpendingReductionNeeded,
        availableFunds,
        goalType: goalWithRecommendations.type
      });
    }

    if (state.account.budget?.spendingRecommendations?.balanced) {
      calculateDiscretionarySavings();
      calculateGoalTimeline();
    }
  }, [state.account.budget?.spendingRecommendations, state.account.budget?.goals]);

  const handleBudgetSubmit = async (budgetData: z.infer<typeof BudgetFormSchema>) => {
    setIsLoading(true);

    const formReqData = {
      categorySpending: budgetData.categoryGroups.reduce<Record<string, any>>((acc, group) => {
        acc[group.groupName!] = {
          groupName: group.groupName,
          target: Number(group.target),
          isTaxDeductible: group.isTaxDeductible,
          targetSource: group.targetSource,
          categories: group.categories.map(cat => ({
            categoryName: cat.categoryName,
            target: Number(cat.target),
            isTaxDeductible: cat.isTaxDeductible
          }))
        };
        return acc;
      }, {})
    };

    try {
      const response = await fetch('/api/onboarding/account/budget/spending', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formReqData)
      });

      if (!response.ok) {
        throw new Error('Failed to save budget');
      }

      const data = await response.json();
      console.log('Budget saved, navigating to new budget:', data.budgetSlug);
      router.replace(`/home/${data.budgetSlug}`);
    } catch (error) {
      console.error('Error saving budget:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-2">
      <Card className="w-full">
        <CardHeader className="space-y-4">
          <div className="flex items-center space-x-2">
            <svg
              className="h-8 w-8 text-primary"
              fill="none"
              height="24"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M16.5 9.4 7.55 4.24" />
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.29 7 12 12 20.71 7" />
              <line x1="12" x2="12" y1="22" y2="12" />
            </svg>
            <span className="text-xl font-semibold">Svend</span>
          </div>
          <h2 className="text-2xl font-bold">
            Let's create your budget
          </h2>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">3 of 3</p>
            <Progress value={100} className="w-full md:w-1/2 lg:w-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <h3 className="text-xl font-semibold my-2">
            <Trans i18nKey={'onboarding:createBudgetSubtitleFinRecommendation'} />
          </h3>
          <p className="text-sm text-muted-foreground max-w-full">
            <Trans i18nKey={'onboarding:createBudgetFinRecommendationInstructions'} />
          </p>
          <div className="flex flex-row flex-1 flex-wrap gap-[8px] py-8 justify-start">
            {discretionarySavings && (
              <div className="flex-1 min-w-[250px] max-w-[250px] shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] dark:shadow-[0_0_15px_rgba(255,255,255,0.05)] dark:hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-shadow duration-300">
                <RecommendationCardDiscretionary
                  recommendation={discretionarySavings}
                />
              </div>
            )}
            {goalTimeline && (
              <div className="flex-1 min-w-[250px] max-w-[250px] shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] dark:shadow-[0_0_15px_rgba(255,255,255,0.05)] dark:hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-shadow duration-300">
                <RecommendationCardGoalTimeline
                  recommendation={goalTimeline}
                />
              </div>
            )}
          </div>

          <h3 className="text-xl font-semibold">
            <Trans i18nKey={'onboarding:createBudgetSubtitleCreateBudgeting'} />
          </h3>

          <p className="text-sm text-muted-foreground max-w-full">
            <Trans i18nKey={'onboarding:createBudgetCreateBudgetingInstructions'} />
          </p>

          <BudgetTable
            onSubmit={handleBudgetSubmit}
            ref={formRef}
          />
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            className="w-full md:w-auto"
            onClick={() => formRef.current?.requestSubmit()}
            disabled={isLoading}
          >
            <Trans
              i18nKey={isLoading
                ? 'onboarding:createBudgetSavingButtonLabel'
                : 'onboarding:createBudgetSaveButtonLabel'
              }
            />
          </Button>
        </CardFooter>
      </Card>
      {isLoading && (
        <LoadingOverlay
          displayLogo={false}
          fullPage={true}
          className="!bg-background/50"
        />
      )}
    </div>
  )
}

export default OnboardingStep3CreateBudget;
