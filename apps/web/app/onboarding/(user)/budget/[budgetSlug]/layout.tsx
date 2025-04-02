import { use } from 'react';
import React from 'react';

import { UserWorkspaceContextProvider } from '@kit/accounts/components';

import {
  Page,
  PageMobileNavigation,
  PageNavigation,
} from '@kit/ui/page';

import { AppLogo } from '~/components/app-logo';
import { withI18n } from '~/lib/i18n/with-i18n';

// home imports
import { HomeMenuNavigation } from './_components/home-menu-navigation';
import { HomeMobileNavigation } from './_components/home-mobile-navigation';
import { loadUserWorkspace } from './_lib/server/load-user-workspace';

function BudgetOnboardingLayout({ children, params }: React.PropsWithChildren & { params: { budgetSlug: string } }) {
  const workspace = use(loadUserWorkspace({ params }));

  return (
    <Page style='header'>
      <PageNavigation>
        <HomeMenuNavigation workspace={workspace} />
      </PageNavigation>

      <PageMobileNavigation className={'flex items-center justify-between'}>
        <AppLogo />
        <HomeMobileNavigation workspace={workspace} />
      </PageMobileNavigation>

      <UserWorkspaceContextProvider value={workspace}>
        {children}
      </UserWorkspaceContextProvider>
    </Page>
  );
}

export default withI18n(BudgetOnboardingLayout);
