import { TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { Tabs } from '@kit/ui/tabs';
import { PageBody } from '@kit/ui/page';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { Trans } from '@kit/ui/trans';
import { HomeLayoutPageHeader } from '../_components/home-page-header';
import PlaidTabMgmt from './_components/plaid-tab-mgmt';
import ManualTabMgmt from './_components/manual/manual-tab-mgmt';
import { AccountSummary } from './_components/account-summary';

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

      <Tabs defaultValue="plaid" className="w-full">
        <TabsList className="h-[58px] w-full bg-background p-1 items-start justify-start">
          <TabsTrigger
            value="plaid"
            className="h-[48px] rounded-md data-[state=active]:bg-green-300 data-[state=active]:text-primary-foreground"
          >
            <Trans i18nKey={'fin-accounts:plaidAccountsTabLabel'} />
          </TabsTrigger>
          <TabsTrigger
            value="manual"
            className="h-[48px] rounded-md data-[state=active]:bg-green-300 data-[state=active]:text-primary-foreground"
          >
            <Trans i18nKey={'fin-accounts:manualAccountsTabLabel'} />
          </TabsTrigger>
        </TabsList>

        <div className="flex-grow space-y-4">
          <TabsContent value="plaid" className="w-full">
            <div className="w-full max-w-[1000px] px-4">
              <PlaidTabMgmt />
            </div>
          </TabsContent>

          <TabsContent value="manual" className="w-full">
            <div className="w-full max-w-[1000px] px-4">
              <ManualTabMgmt />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </PageBody>
  );
}
