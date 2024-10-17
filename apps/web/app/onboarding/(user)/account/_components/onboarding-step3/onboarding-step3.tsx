import React, { useState } from 'react';
import {Card, CardHeader, CardContent, CardFooter} from '@kit/ui/card';
import { Progress } from '@kit/ui/progress';
import { Trans } from '@kit/ui/trans';
import { Button } from '@kit/ui/button';
import {RecomendationCard} from "~/onboarding/(user)/account/_components/onboarding-step3/recomendation-card";
import {BudgetTable} from "~/onboarding/(user)/account/_components/onboarding-step3/budget-table";
import { useRouter } from 'next/navigation';

function OnboardingStep3CreateBudget() {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleSave = async () => {
        setIsLoading(true);
        try {
            // Make API call to save the budget using fetch
            const response = await fetch('/api/onboarding/account/budget', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error('Failed to save budget');
            }

            const data = await response.json();
            const { budgetId, budgetSlug } = data;

            // Redirect to the budget page using Next.js router
            router.push(`/home/${budgetSlug}`);
        } catch (error) {
            console.error('Error saving budget:', error);
            // Handle error (e.g., show an error message to the user)
        } finally {
            setIsLoading(false);
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
              <RecomendationCard
                  title={'onboarding:createBudgetCardGoalTitle'}
                  description={'onboarding:createBudgetCardGoalDescription'}
              />

              <RecomendationCard
                  title={'onboarding:createBudgetCardAdditionalTitle'}
                  description={'onboarding:createBudgetCardAdditionalDescription'}
              />

              <RecomendationCard
                  title={'onboarding:createBudgetCardAdditionalTitle'}
                  description={'onboarding:createBudgetCardAdditionalDescription'}
              />

              <RecomendationCard
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

            <BudgetTable />
          </CardContent>
          <CardFooter>
            <Button 
                variant="outline" 
                className="w-full md:w-auto"
                onClick={handleSave}
                disabled={isLoading}
            >
              {isLoading ? (
                  <Trans i18nKey={'onboarding:createBudgetSaveButtonLabel'} />
              ) : (
                  <Trans i18nKey={'onboarding:createBudgetSaveButtonLabel'} />
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

export default OnboardingStep3CreateBudget;
