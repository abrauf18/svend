"use client";

import React, { useState, useEffect } from 'react';
import OnboardingStep1ConnectPlaidAccounts from './onboarding-step1';
import OnboardingStep2FinBackground from './onboarding-step2';
import OnboardingStep2AnalyzingData from './onboarding-step2-analyzing';
import OnboardingStep3CreateBudget from './onboarding-step3';
import { AccountOnboardingStepContextKey, useOnboardingContext } from '@kit/accounts/components';
import { GlobalLoader } from '@kit/ui/global-loader';
import { useRouter } from 'next/navigation';

export const steps: Array<{
    component: React.ComponentType<any>;
    contextKeys: Array<AccountOnboardingStepContextKey>;
}> = [
    {
        component: OnboardingStep1ConnectPlaidAccounts,
        contextKeys: ['start', 'plaid']
    },
    {
        component: OnboardingStep2FinBackground,
        contextKeys: ['profile_goals']
    },
    {
        component: OnboardingStep2AnalyzingData,
        contextKeys: ['analyze_spending']
    },
    {
        component: OnboardingStep3CreateBudget,
        contextKeys: ['budget_setup', 'end']
    }
];

export const OnboardingMultiStep = () => {
    const router = useRouter();
    
    const { state, accountNextStep: nextStepAccount, accountPrevStep: prevStepAccount } = useOnboardingContext();
    
    const [loading, setLoading] = useState(true);
    
    let currentStep = steps.find(step => step.contextKeys.includes(state?.account.contextKey as AccountOnboardingStepContextKey));
    
    useEffect(() => {
        currentStep = steps.find(step => step.contextKeys.includes(state?.account.contextKey as AccountOnboardingStepContextKey));
        if (state?.account.contextKey && currentStep) {
            setLoading(false);
        }
    }, [state]);

    if (loading) {
        return <GlobalLoader fullPage />;
    }

    if (!state || !nextStepAccount || !prevStepAccount) {
        return <div>Error: OnboardingProvider props are not defined</div>;
    }
    if (!currentStep) {
        return <div>Error: Current step is not defined</div>;
    }

    const StepComponent = currentStep.component;

    return <StepComponent 
        nextStepAccount={nextStepAccount} 
        prevStepAccount={prevStepAccount} 
    />;
};
