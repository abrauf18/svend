import React from 'react';
import { PageBody } from '@kit/ui/page';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { OnboardingMultiStep } from './_components/onboarding-multi-step';
import { OnboardingContextProvider } from '@kit/accounts/components';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('onboarding:startPage');

  return {
    title,
  };
};

function UserOnboardingPage() {
  return (
    <PageBody>
      <OnboardingContextProvider>
        <OnboardingMultiStep />
      </OnboardingContextProvider>
    </PageBody>
  );
}

export default withI18n(UserOnboardingPage);
