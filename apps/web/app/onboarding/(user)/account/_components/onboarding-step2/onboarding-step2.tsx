import React, { useRef, useState } from 'react';

import { useOnboardingContext } from '@kit/accounts/components';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@kit/ui/card';
import { Progress } from '@kit/ui/progress';
import { Trans } from '@kit/ui/trans';

import { PersonalInformation } from './part1-personal-information';
import { FinancialInformation } from './part2-financial-information';
import { FinancialGoals } from './part3-financial-goals';
import { GoalsSavings } from './part4-goals-savings';
import { GoalsDebt } from './part5-goals-debt';
import { GoalsInvestment } from './part6-goals-investment';


function OnboardingStep2ProfileGoals() {
  const [currentSubStep, setCurrentSubStep] = useState(1);
  const [isFormValid, setIsFormValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitFormRef = useRef<(() => Promise<boolean>) | null>(null);

  const { state, accountNextStep } = useOnboardingContext();

  const handleFormSubmit = async () => {
    if (submitFormRef.current) {
      setIsSubmitting(true);
      try {
        const success = await submitFormRef.current();
        if (success) {
          if (currentSubStep < 6) {
            setCurrentSubStep((prev) => prev + 1);
          } else {
            accountNextStep();
          }
        } else {
          console.log('Form submission failed');
        }
      } catch (error) {
        console.error('Error submitting form:', error);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      console.log('Form is not valid');
    }
  };

  const handleSkipStep = () => {
    if (currentSubStep < 6) {
      setCurrentSubStep((prev) => prev + 1);
    } else {
      accountNextStep();
    }
  };

  // Renders the appropriate step component
  const renderStep = () => {
    switch (currentSubStep) {
      case 1:
        return (
          <PersonalInformation
            initialData={state.account.profileData}
            onValidationChange={setIsFormValid}
            triggerSubmit={(submitFunc) => (submitFormRef.current = submitFunc)}
          />
        );
      case 2:
        return (
          <FinancialInformation
            initialData={state.account.profileData}
            onValidationChange={setIsFormValid}
            triggerSubmit={(submitFunc) => (submitFormRef.current = submitFunc)}
          />
        );
      case 3:
        return (
          <FinancialGoals
            initialData={state.account.profileData}
            onValidationChange={setIsFormValid}
            triggerSubmit={(submitFunc) => (submitFormRef.current = submitFunc)}
          />
        );
      case 4:
        return (
          <GoalsSavings
            initialData={state.account.budget.goals?.find(goal => goal.type === 'savings')}
            onValidationChange={setIsFormValid}
            triggerSubmit={(submitFunc) => (submitFormRef.current = submitFunc)}
          />
        );
      case 5:
        return (
          <GoalsDebt
            initialData={state.account.budget.goals?.find(goal => goal.type === 'debt')}
            onValidationChange={setIsFormValid}
            triggerSubmit={(submitFunc) => (submitFormRef.current = submitFunc)}
          />
        );
      case 6:
        return (
          <GoalsInvestment
            initialData={state.account.budget.goals?.find(goal => goal.type === 'investment')}
            onValidationChange={setIsFormValid}
            triggerSubmit={(submitFunc) => (submitFormRef.current = submitFunc)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl p-4 h-[calc(100vh-6rem)]">
      <Card className="w-full h-full flex flex-col">
        <CardHeader className="space-y-4 flex-shrink-0">
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
            <Trans i18nKey={'onboarding:finBackgroundTitle'} />
          </h2>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Step 2 of 3</p>
            <Progress
              value={33 + (currentSubStep / 6) * 33}
              className="w-full md:w-1/2 lg:w-full"
            />
          </div>
          <br />
          <div>
            <p className="w-full md:w-auto">Part {currentSubStep} of 6</p>
          </div>
          <div className="flex space-x-1">
            {[1, 2, 3, 4, 5, 6].map((step) => (
              <span
                key={step}
                className={`h-2 w-2 ${currentSubStep >= step ? 'bg-primary' : 'bg-muted'} rounded-full`}
              ></span>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 flex-1 overflow-y-auto">
          <p className="max-w-md text-sm text-muted-foreground">
            <Trans i18nKey={'onboarding:finBackgroundInstructionText'} />
          </p>
          {renderStep()}
        </CardContent>
        <CardFooter className="flex-shrink-0 border-t pt-4">
          <div className="flex space-x-4">
            <Button
              variant="outline"
              className="w-full md:w-auto"
              onClick={handleFormSubmit}
              disabled={isSubmitting || !isFormValid}
            >
              {isSubmitting ? (
                'Saving...'
              ) : (
                <Trans i18nKey={'onboarding:finBackgroundNextButtonLabel'} />
              )}
            </Button>
            {currentSubStep >= 4 && currentSubStep <= 6 && (
              <Button
                variant="outline"
                className="w-full md:w-auto"
                onClick={handleSkipStep}
              >
                <Trans i18nKey="skip" />
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export default OnboardingStep2ProfileGoals;
