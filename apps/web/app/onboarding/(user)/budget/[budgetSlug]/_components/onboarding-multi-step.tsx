"use client";

import React, { useState, useEffect } from 'react';
import OnboardingStep1 from './onboarding-step1/onboarding-step1';
import OnboardingStep2ProfileGoals from './onboarding-step2/onboarding-step2';
import OnboardingStep2AnalyzingData from './onboarding-step2-analyzing/onboarding-step2-analyzing';
import OnboardingStep3CreateBudget from './onboarding-step3/onboarding-step3';
import { GlobalLoader } from '@kit/ui/global-loader';
import { BudgetOnboardingStepContextKey, budgetOnboardingSteps } from '~/lib/model/budget.onboarding.types';
import { useBudgetOnboardingContext } from '~/components/budget-onboarding-context';

export const steps: Array<{
    component: React.ComponentType<any>;
    contextKeys: Array<BudgetOnboardingStepContextKey>;
}> = [
    {
        component: OnboardingStep1,
        contextKeys: budgetOnboardingSteps[0]?.contextKeys || []
    },
    {
        component: OnboardingStep2ProfileGoals,
        contextKeys: budgetOnboardingSteps[1]?.contextKeys || []
    },
    {
        component: OnboardingStep2AnalyzingData,
        contextKeys: budgetOnboardingSteps[2]?.contextKeys || []
    },
    {
        component: OnboardingStep3CreateBudget,
        contextKeys: budgetOnboardingSteps[3]?.contextKeys || []
    }
];

export const OnboardingMultiStep = () => {
    const { state, accountNextStep, accountPrevStep, accountPlaidConnItemAddOne, accountPlaidItemAccountUnlinkOne } = useBudgetOnboardingContext();
    const [loading, setLoading] = useState(true);

    let currentStep = steps.find(step => step.contextKeys.includes(state?.budget.contextKey as BudgetOnboardingStepContextKey));

    useEffect(() => {
        currentStep = steps.find(step => step.contextKeys.includes(state?.budget.contextKey as BudgetOnboardingStepContextKey));
        if (state?.budget.contextKey && currentStep) {
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
        accountPlaidItemAccountUnlinkOne={accountPlaidItemAccountUnlinkOne}
    />;
};
