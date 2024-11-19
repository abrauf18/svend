import React, { useState, useRef } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@kit/ui/card';
import { Progress } from '@kit/ui/progress';
import { Trans } from '@kit/ui/trans';
import { Button } from '@kit/ui/button';
import { RecommendationCard } from "./recommendation-card";
import { BudgetTable } from "./budget-table";
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import type { BudgetFormSchema } from './budget-table';
import { BudgetCategoryGroupSpending } from '~/lib/model/budget.types';
import { LoadingOverlay } from '@kit/ui/loading-overlay';

function OnboardingStep3CreateBudget() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const handleBudgetSubmit = async (budgetData: z.infer<typeof BudgetFormSchema>) => {
    setIsLoading(true);

    const formReqData = {
      categorySpending: budgetData.categoryGroups.reduce<Record<string, BudgetCategoryGroupSpending>>((acc, group) => {
        acc[group.groupName] = {
          groupName: group.groupName,
          spending: group.spending ?? 0,
          recommendation: group.recommendation ?? 0,
          target: Number(group.target),
          isTaxDeductible: group.isTaxDeductible,
          targetSource: group.targetSource,
          categories: group.categories.map(cat => ({
            categoryName: cat.categoryName,
            spending: cat.spending ?? 0,
            recommendation: cat.recommendation ?? 0,
            target: Number(cat.target),
            isTaxDeductible: cat.isTaxDeductible,
            targetSource: group.targetSource === 'category' ? 'category' : 'group'
          }))
        };
        return acc;
      }, {}) as Record<string, BudgetCategoryGroupSpending>
    };

    console.log('Budget category group spending form submitted:', formReqData);

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
      router.replace(`/home/${data.budgetSlug}`);
    } catch (error) {
      console.error('Error saving budget:', error);
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (formRef.current) {
      const submitEvent = new SubmitEvent('submit', {
        bubbles: true,
        cancelable: true,
      });

      formRef.current.dispatchEvent(submitEvent);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
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
            <Trans i18nKey={'onboarding:createBudgetTitle'} />
          </h2>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">3 of 3</p>
            <Progress value={100} className="w-full md:w-1/2 lg:w-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <h3 className="text-xl font-semibold">
            <Trans i18nKey={'onboarding:createBudgetSubtitleFinRecommendation'} />
          </h3>
          <p className="text-sm text-muted-foreground max-w-full">
            <Trans i18nKey={'onboarding:createBudgetFinRecommendationInstructions'} />
          </p>
          <div className="flex flex-row flex-1 flex-wrap gap-[8px] justify-center">
            <RecommendationCard
              title={'onboarding:createBudgetCardGoalTitle'}
              description={'onboarding:createBudgetCardGoalDescription'}
            />

            <RecommendationCard
              title={'onboarding:createBudgetCardAdditionalTitle'}
              description={'onboarding:createBudgetCardAdditionalDescription'}
            />

            <RecommendationCard
              title={'onboarding:createBudgetCardAdditionalTitle'}
              description={'onboarding:createBudgetCardAdditionalDescription'}
            />

            <RecommendationCard
              title={'onboarding:createBudgetCardAdditionalTitle'}
              description={'onboarding:createBudgetCardAdditionalDescription'}
            />
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
            onClick={handleSave}
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
