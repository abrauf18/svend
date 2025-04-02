import React from 'react';
import { PageBody } from '@kit/ui/page';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { OnboardingMultiStep } from './_components/onboarding-multi-step';
import { BudgetOnboardingContextProvider } from '~/components/budget-onboarding-context';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('onboarding:startPage');

  return {
    title,
  };
};

function BudgetOnboardingPage({
  params,
}: {
  params: { budgetSlug: string };
}) {
  return (
    <PageBody>
      <BudgetOnboardingContextProvider budgetSlug={params.budgetSlug}>
        <OnboardingMultiStep />
      </BudgetOnboardingContextProvider>
    </PageBody>
  );
}

export default withI18n(BudgetOnboardingPage);
