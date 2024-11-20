import { use } from 'react';

import { cookies } from 'next/headers';

import { If } from '@kit/ui/if';
import {
  Page,
  PageLayoutStyle,
  PageMobileNavigation,
  PageNavigation,
} from '@kit/ui/page';

import { AppLogo } from '~/components/app-logo';
import { getTeamAccountSidebarConfig } from '~/config/team-account-navigation.config';
import { withI18n } from '~/lib/i18n/with-i18n';

// local imports
import { TeamAccountLayoutMobileNavigation } from './_components/team-account-layout-mobile-navigation';
import { TeamAccountLayoutSidebar } from './_components/team-account-layout-sidebar';
import { TeamAccountNavigationMenu } from './_components/team-account-navigation-menu';
import FirstTimeInviteMembersModal from './_components/first-time-invite-members-modal';
import { BudgetWorkspaceContextProvider } from '~/components/budget-workspace-context';
import { createBudgetService } from '~/lib/server/budget.service';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { loadBudgetWorkspace } from './_lib/server/team-account-budget-manage-page.loader';

interface Params {
  account: string;
}

function TeamWorkspaceLayout({
  children,
  params,
}: React.PropsWithChildren<{
  params: Params;
}>) {
  const data = use(loadBudgetWorkspace(params.account));
  const style = getLayoutStyle(params.account);

  const accounts = data.accounts.map(({ name, slug, picture_url }) => ({
    label: name,
    value: slug,
    image: picture_url,
  }));

  const budgetService = createBudgetService(getSupabaseServerClient());

  return (
    <Page style={style}>
      <PageNavigation>
        <If condition={style === 'sidebar'}>
          <TeamAccountLayoutSidebar
            collapsed={false}
            account={params.account}
            accountId={data.account.id}
            accounts={accounts}
            user={data.user}
          />
        </If>

        <If condition={style === 'header'}>
          <TeamAccountNavigationMenu workspace={data} />
        </If>
      </PageNavigation>

      <PageMobileNavigation className={'flex items-center justify-between'}>
        <AppLogo />

        <div className={'flex space-x-4'}>
          <TeamAccountLayoutMobileNavigation
            userId={data.user.id}
            accounts={accounts}
            account={params.account}
          />
        </div>
      </PageMobileNavigation>

      <BudgetWorkspaceContextProvider value={{
        user: data.user,
        accounts: data.accounts,
        account: data.account,
        budget: budgetService.parseBudget(data.budget)!,
        budgetTransactions: budgetService.parseBudgetTransactions(data.budgetTransactions),
        budgetCategories: data.budgetCategories,
        budgetTags: budgetService.parseBudgetTags(data.budgetTags || []),
      }}>
        <FirstTimeInviteMembersModal
          params={{
            accountSlug: data.account.slug,
          }}
        />
        {children}
      </BudgetWorkspaceContextProvider>
    </Page>
  );
}

function getLayoutStyle(account: string) {
  return (
    (cookies().get('layout-style')?.value as PageLayoutStyle) ??
    getTeamAccountSidebarConfig(account).style
  );
}

export default withI18n(TeamWorkspaceLayout);
