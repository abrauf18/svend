import React, { useEffect, useRef, useState } from 'react';

import { useOnboardingContext } from '@kit/accounts/components';
import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@kit/ui/card';
import { Progress } from '@kit/ui/progress';
import { Trans } from '@kit/ui/trans';

import { PersonalInformation } from './part1-personal-information';
import { FinancialInformation } from './part2-financial-information';
import { FinancialGoals } from './part3-financial-goals';

interface ProfileData {
  full_name: string | null;
  age: string | null;
  marital_status: string | null;
  dependents: string | null;
  income_level: string | null;
  savings: string | null;
  current_debt: string[] | null;
  primary_financial_goal: string[] | null;
  goal_timeline: string | null;
  monthly_contribution: string | null;
}

function OnboardingStep2FinBackground() {
  const [currentSubStep, setCurrentSubStep] = useState(1);
  const [isFormValid, setIsFormValid] = useState(false);
  const [personalInfoValid, setPersonalInfoValid] = useState(false);
  const [financialInfoValid, setFinancialInfoValid] = useState(false);
  const [financialGoalsValid, setFinancialGoalsValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  const submitFormRef = useRef<(() => Promise<boolean>) | null>(null);

  const { state, accountNextStep } = useOnboardingContext();

  const handleFormSubmit = async () => {
    if (submitFormRef.current) {
      setIsSubmitting(true);
      try {
        const success = await submitFormRef.current();
        if (success) {
          if (currentSubStep === 1) {
            setPersonalInfoValid(true);
            setCurrentSubStep(2);
          } else if (currentSubStep === 2) {
            setFinancialInfoValid(true);
            setCurrentSubStep(3);
          } else if (currentSubStep === 3) {
            setFinancialGoalsValid(true);
            console.log('Financial Goals Valid');
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

  async function fetchPersonalInfo() {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('acct_fin_profile')
      .select('*')
      .eq('account_id', user.id)
      .single();

    if (data) {
      setProfileData({
        ...data,
        age: data.age?.toString() || '',
        dependents: data.dependents?.toString() || ''
      });
    }

    if (error) {
      console.error('Error fetching personal info:', error);
      throw error;
    }
  }

  useEffect(() => {
    fetchPersonalInfo();
  }, []);

  // Renders the appropriate step component
  const renderStep = () => {
    switch (currentSubStep) {
      case 1:
        return (
          <PersonalInformation
            initialData={profileData ? {
              full_name: profileData.full_name || '',
              age: profileData.age || '',
              marital_status: profileData.marital_status || '',
              dependents: profileData.dependents || ''
            } : null}
            onValidationChange={setIsFormValid}
            triggerSubmit={(submitFunc) => (submitFormRef.current = submitFunc)}
          />
        );
      case 2:
        return (
          <FinancialInformation
            initialData={profileData ? {
              income_level: profileData.income_level || '',
              savings: profileData.savings || '',
              current_debt: profileData.current_debt || []
            } : null}
            onValidationChange={setIsFormValid}
            triggerSubmit={(submitFunc) => (submitFormRef.current = submitFunc)}
          />
        );
      case 3:
        return (
          <FinancialGoals
            initialData={profileData ? {
              primary_financial_goal: profileData.primary_financial_goal || [],
              goal_timeline: profileData.goal_timeline || '',
              monthly_contribution: profileData.monthly_contribution || ''
            } : null}
            onValidationChange={setIsFormValid}
            triggerSubmit={(submitFunc) => (submitFormRef.current = submitFunc)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl p-4">
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
            <Trans i18nKey={'onboarding:finBackgroundTitle'} />
          </h2>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Step 2 of 3</p>
            <Progress value={66} className="w-full md:w-1/2 lg:w-full" />
          </div>
          <br />
          <div>
            <p className="w-full md:w-auto">Part {currentSubStep} of 3</p>
          </div>
          <div className="flex space-x-1">
            <span
              className={`h-2 w-2 ${currentSubStep >= 1 ? 'bg-primary' : 'bg-muted'} rounded-full`}
            ></span>
            <span
              className={`h-2 w-2 ${currentSubStep >= 2 ? 'bg-primary' : 'bg-muted'} rounded-full`}
            ></span>
            <span
              className={`h-2 w-2 ${currentSubStep >= 3 ? 'bg-primary' : 'bg-muted'} rounded-full`}
            ></span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="max-w-md text-sm text-muted-foreground">
            <Trans i18nKey={'onboarding:finBackgroundInstructionText'} />
          </p>
          {renderStep()}
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            className="w-full md:w-auto"
            onClick={handleFormSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              'Submitting...'
            ) : (
              <Trans i18nKey={'onboarding:finBackgroundNextButtonLabel'} />
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default OnboardingStep2FinBackground;
