import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@kit/ui/card';
import { Progress } from '@kit/ui/progress';
import { Trans } from '@kit/ui/trans';
import { ConnectPlaidAccountsButton } from './connect-plaid-accounts-button';
import { Button } from '@kit/ui/button';
import { AccountOnboardingPlaidConnectionItem, useOnboardingContext } from '@kit/accounts/components';
import { PlaidConnectionItems } from '../plaid-connection-items';

function OnboardingStep1ConnectPlaidAccounts() {
  const [hasPlaidConnection, setHasPlaidConnection] = useState(false);
  const { state, accountNextStep, accountChangeStepContextKey } = useOnboardingContext();

  useEffect(() => {
    if (!hasPlaidConnection && state?.account.plaidConnectionItems && state.account.plaidConnectionItems.length > 0) {
      setHasPlaidConnection(true);
      accountChangeStepContextKey('plaid');
    }
  }, [state]);

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <Card className="w-full">
        <CardHeader className="space-y-4">
          <div className="flex items-center space-x-2">
            <svg
              className="h-8 w-8 text-primary"
              fill="none"
              height="24"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M16.5 9.4 7.55 4.24" />
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.29 7 12 12 20.71 7" />
              <line x1="12" x2="12" y1="22" y2="12" />
            </svg>
            <span className="text-xl font-semibold">Svend</span>
          </div>
          <h2 className="text-2xl font-bold">
            <Trans i18nKey={'onboarding:connectAccountsTitle'} />
          </h2>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">1 of 3</p>
            <Progress value={33} className="w-full md:w-1/2 lg:w-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground max-w-md">
            <Trans i18nKey={'onboarding:connectAccountsInstructionText'} />
          </p>

          <PlaidConnectionItems />

          <ConnectPlaidAccountsButton redirectType="account" />
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="w-full md:w-auto" disabled={!hasPlaidConnection} onClick={accountNextStep}>
            <Trans i18nKey={'onboarding:connectAccountsNextButtonLabel'} />
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default OnboardingStep1ConnectPlaidAccounts;