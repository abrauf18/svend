import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createTeamAccountsApi } from '@kit/team-accounts/api';
import { TeamAccountSettingsContainer } from '@kit/team-accounts/components';
import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kit/ui/tabs";

import featuresFlagConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';

import TeamAccountRulesPage from './components/team-account-rule-page';
// local imports

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('budgets:settings:pageTitle');

  return {
    title,
  };
};

interface Props {
  params: {
    account: string;
  };
}

const paths = {
  budgetAccountSettings: pathsConfig.app.accountGeneral,
};

async function TeamAccountSettingsPage(props: Props) {
  const api = createTeamAccountsApi(getSupabaseServerClient());
  const data = await api.getTeamAccount(props.params.account);

  const account = {
    id: data.id,
    name: data.name,
    pictureUrl: data.picture_url,
    slug: data.slug as string,
    primaryOwnerUserId: data.primary_owner_user_id,
  };

  const features = {
    enableTeamDeletion: featuresFlagConfig.enableTeamDeletion,
  };

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account.slug}
        title={<Trans i18nKey={'budgets:settings.pageTitle'} />}
        description={<AppBreadcrumbs />}
      />

      <PageBody>
        <Tabs defaultValue="general" className="w-full flex-1 flex flex-col items-start">
          <TabsList className="h-[58px] bg-background p-1">
            <TabsTrigger value="general" className="h-[48px] rounded-md data-[state=active]:bg-green-300 data-[state=active]:text-primary-foreground">
              <Trans i18nKey={'budgets:settings.tabs.general'} />
            </TabsTrigger>
            <TabsTrigger value="rules" className="h-[48px] rounded-md data-[state=active]:bg-green-300 data-[state=active]:text-primary-foreground">
              <Trans i18nKey={'budgets:settings.tabs.rules'} />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <div className={'flex max-w-2xl flex-1 flex-col'}>
              <TeamAccountSettingsContainer
                account={account}
                paths={paths}
                features={features}
              />
            </div>
          </TabsContent>

          <TabsContent value="rules" className='w-full flex justify-center items-center' >
            <div className={'flex w-full justify-center items-center'}>
              <TeamAccountRulesPage/>
            </div>
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}

export default TeamAccountSettingsPage;
