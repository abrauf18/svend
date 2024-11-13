import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

// local imports
import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { loadMembersPageData } from './_lib/server/manage-page.loader';
import TransactionDashboard from './_components/transactions-dashboard';

interface Params {
  params: {
    account: string;
  };
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('teams:members.pageTitle');

  return {
    title,
  };
};

async function TeamAccountMembersPage({ params }: Params) {
  const client = getSupabaseServerClient();

  const [members, invitations, canAddMember, { user, account }] =
    await loadMembersPageData(client, params.account);

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={<Trans i18nKey={'common:routes.manage'} />}
        description={<AppBreadcrumbs />}
        account={account.slug}
      />

      <PageBody>
        {/*<div className={'flex w-full max-w-4xl flex-col space-y-4 pb-32'}>*/}
        <div className={'flex w-full max-w-full flex-col space-y-4 pb-32'}>
          <TransactionDashboard budgetId={account.budget_id} />
        </div>
      </PageBody>
    </>
  );
}

export default withI18n(TeamAccountMembersPage);
