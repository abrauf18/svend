import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

// local imports
import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import BudgetManageHome from './_components/budget-manage-home';

interface Params {
  params: {
    accountSlug: string;
  };
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('teams:members.pageTitle');

  return {
    title,
  };
};

async function BudgetManagePage({ params }: Params) {
  return (
    <>
      <TeamAccountLayoutPageHeader
        title={<Trans i18nKey={'common:routes.manage'} />}
        description={<AppBreadcrumbs />}
        account={params.accountSlug}
      />

      <PageBody>
        <div className={'flex w-full max-w-full flex-col space-y-4 pb-32'}>
          <BudgetManageHome />
        </div>
      </PageBody>
    </>
  );
}

export default withI18n(BudgetManagePage);
