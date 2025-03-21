import { PageBody } from '@kit/ui/page';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { Trans } from '@kit/ui/trans';
import { HomeLayoutPageHeader } from '../_components/home-page-header';
import { AccountSummary } from './_components/account-summary';
import { FinAccountsTabs } from './_components/fin-accounts-tabs';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('fin-accounts:pageTitle');

  return {
    title,
  };
};

export default function PersonalAccountFinAccountsPage() {
  return (
    <PageBody>
      <HomeLayoutPageHeader
        title={<Trans i18nKey={'fin-accounts:pageTitle'} />}
        description={<Trans i18nKey={'fin-accounts:pageDescription'} />}
      />

      <AccountSummary />
      
      <FinAccountsTabs />
    </PageBody>
  );
}
