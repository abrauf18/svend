"use client";

import React, { useState, useEffect } from 'react';
import OnboardingStep1ConnectPlaidAccounts from './onboarding-step1/onboarding-step1';
import OnboardingStep2ProfileGoals from './onboarding-step2/onboarding-step2';
import OnboardingStep2AnalyzingData from './onboarding-step2-analyzing/onboarding-step2-analyzing';
import OnboardingStep3CreateBudget from './onboarding-step3/onboarding-step3';
import { useOnboardingContext } from '@kit/accounts/components';
import { GlobalLoader } from '@kit/ui/global-loader';
import { AccountOnboardingStepContextKey, accountOnboardingSteps } from '~/lib/model/onboarding.types';

export const steps: Array<{
    component: React.ComponentType<any>;
    contextKeys: Array<AccountOnboardingStepContextKey>;
}> = [
        {
            component: OnboardingStep1ConnectPlaidAccounts,
            contextKeys: accountOnboardingSteps[0]?.contextKeys || []
        },
        {
            component: OnboardingStep2ProfileGoals,
            contextKeys: accountOnboardingSteps[1]?.contextKeys || []
        },
        {
            component: OnboardingStep2AnalyzingData,
            contextKeys: accountOnboardingSteps[2]?.contextKeys || []
        },
        {
            component: OnboardingStep3CreateBudget,
            contextKeys: accountOnboardingSteps[3]?.contextKeys || []
        }
    ];

export const OnboardingMultiStep = () => {
    const { state, accountNextStep, accountPrevStep, accountPlaidConnItemAddOne, accountPlaidItemAccountUnlinkOne } = useOnboardingContext();

    const [loading, setLoading] = useState(true);

    let currentStep = steps.find(step => step.contextKeys.includes(state?.account.contextKey as AccountOnboardingStepContextKey));

    useEffect(() => {
        currentStep = steps.find(step => step.contextKeys.includes(state?.account.contextKey as AccountOnboardingStepContextKey));
        if (state?.account.contextKey && currentStep) {
            setLoading(false);
        }
    }, [state]);

    if (loading) {
        return <GlobalLoader displayTopLoadingBar />;
    }

    if (!state || !accountNextStep || !accountPrevStep || !accountPlaidConnItemAddOne || !accountPlaidItemAccountUnlinkOne) {
        return <div>Error: OnboardingProvider props are not defined</div>;
    }
    if (!currentStep) {
        return <div>Error: Current step is not defined</div>;
    }

    const StepComponent = currentStep.component;

    return <StepComponent
        accountNextStep={accountNextStep}
        accountPrevStep={accountPrevStep}
        accountPlaidConnItemAddOne={accountPlaidConnItemAddOne}
    />;
};
