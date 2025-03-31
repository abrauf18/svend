'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { Trans } from '@kit/ui/trans';

import { TeamAccountDangerZone } from './team-account-danger-zone';
import { UpdateTeamAccountImage } from './update-team-account-image-container';
import { UpdateTeamAccountNameForm } from './update-team-account-name-form';

export function TeamAccountSettingsContainer(props: {
  account: {
    name: string;
    slug: string;
    id: string;
    pictureUrl: string | null;
    primaryOwnerUserId: string;
  };

  paths: {
    budgetAccountSettings: string;
  };

  features: {
    enableTeamDeletion: boolean;
  };
}) {
  return (
    <div className={'flex w-full flex-col space-y-4'}>
      <Card>
        <CardHeader>
          <CardTitle>
            <Trans i18nKey={'budgets:settings.budgetLogo'} />
          </CardTitle>

          <CardDescription>
            <Trans i18nKey={'budgets:settings.budgetLogoDescription'} />
          </CardDescription>
        </CardHeader>

        <CardContent>
          <UpdateTeamAccountImage account={props.account} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Trans i18nKey={'budgets:settings.budgetName'} />
          </CardTitle>

          <CardDescription>
            <Trans i18nKey={'budgets:settings.budgetNameDescription'} />
          </CardDescription>
        </CardHeader>

        <CardContent>
          <UpdateTeamAccountNameForm
            path={props.paths.budgetAccountSettings}
            account={props.account}
          />
        </CardContent>
      </Card>

      <Card className={'border-destructive border'}>
        <CardHeader>
          <CardTitle>
            <Trans i18nKey={'budgets:settings.dangerZone'} />
          </CardTitle>

          <CardDescription>
            <Trans i18nKey={'budgets:settings.dangerZoneDescription'} />
          </CardDescription>
        </CardHeader>

        <CardContent>
          <TeamAccountDangerZone
            primaryOwnerUserId={props.account.primaryOwnerUserId}
            account={props.account}
            features={props.features}
          />
        </CardContent>
      </Card>
    </div>
  );
}
