import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent } from '@kit/ui/card';
import { Progress } from '@kit/ui/progress';
import { Trans } from '@kit/ui/trans';
import { useOnboardingContext } from '@kit/accounts/components';
import { Budget } from '~/lib/model/budget.types';
import { OnboardingRecommendSpendingAndGoalsResult } from '~/lib/server/budget.service';

export default function OnboardingStep2AnalyzingData() {
  const { state, accountBudgetUpdate, accountNextStep } = useOnboardingContext();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    const runAnalysis = async () => {
      try {
        await analyzeSpending();
      } catch (error) {
        console.error('Error analyzing spending:', error);
      }
    };

    if (isMounted) {
      runAnalysis();
    }

    return () => {
      setIsMounted(false);
    };
  }, [isMounted]);

  useEffect(() => {
    if (
      state.account.budget.spendingTracking &&
      Object.keys(state.account.budget.spendingTracking).length > 0 &&
      state.account.contextKey === 'analyze_spending'
    ) {
      accountNextStep();
    }
  }, [state.account.budget.spendingTracking]);

  const analyzeSpending = async () => {
    const response = await fetch('/api/onboarding/account/budget/analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (response.status === 409) {
      console.log('Budget spending analysis already in progress. Subscribing to events to detect completion...');
      // TODO: Implement event subscription logic here
      throw new Error('Analysis subscription not yet implemented');
    } else if (!response.ok) {
      let errorRes = await response.json();
      console.log('Error analyzing spending:', errorRes);
      throw new Error(errorRes.message);
    }
  
    // update local state
    const { analysisResult } = await response.json();
    if (!analysisResult) {
      throw new Error('No analysis result received from analysis');
    }

    const { spendingRecommendations, spendingTrackings, goalSpendingRecommendations, goalSpendingTrackings } = analysisResult as OnboardingRecommendSpendingAndGoalsResult;

    const handleBudgetUpdate = () => {
      const newBudget: Budget = {
        ...state.account.budget,
        spendingTracking: spendingTrackings,
        spendingRecommendations: {
          balanced: spendingRecommendations!.balanced,
          conservative: spendingRecommendations!.conservative,
          relaxed: spendingRecommendations!.relaxed
        },
        goalSpendingRecommendations: goalSpendingRecommendations,
        goalSpendingTrackings: goalSpendingTrackings,
        goals: state.account.budget.goals,
        onboardingStep: 'budget_setup',
        linkedFinAccounts: state.account.budget.linkedFinAccounts
      } as Budget;
  
      console.log('Updating budget with:', newBudget); // Log the new budget
      accountBudgetUpdate(newBudget);

    };
    handleBudgetUpdate();
  }

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
            <Trans i18nKey={'onboarding:analyzingDataTitle'} />
          </h2>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">2 of 3</p>
            <Progress value={80} className="w-full md:w-1/2 lg:w-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground max-w-md">
            <Trans i18nKey={'onboarding:analyzingDataInstructionText'} />
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
