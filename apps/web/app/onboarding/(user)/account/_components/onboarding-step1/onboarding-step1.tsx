import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@kit/ui/card';
import { Progress } from '@kit/ui/progress';
import { Trans } from '@kit/ui/trans';
import { Button } from '@kit/ui/button';
import { useOnboardingContext } from '@kit/accounts/components';
import { PlaidConnectionItems } from './plaid-connection-items';
import { usePlaidLink, PlaidLinkOptions } from 'react-plaid-link';

function OnboardingStep1ConnectPlaidAccounts() {
  const [hasPlaidConnection, setHasPlaidConnection] = useState(false);
  const [loading, setLoading] = useState(false);
  const { state, accountNextStep, accountChangeStepContextKey, accountPlaidConnItemAddOne } = useOnboardingContext();
  const [linkToken, setLinkToken] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPlaidConnection && state?.account.plaidConnectionItems && state.account.plaidConnectionItems.length > 0) {
      setHasPlaidConnection(true);
      accountChangeStepContextKey('plaid');
    }
  }, [state]);

  const onSuccess = useCallback(async (public_token: string, metadata: any) => {
    try {
      const response = await fetch('/api/onboarding/account/plaid/item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          budgetId: state?.account.budget?.id,
          plaidPublicToken: public_token,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to complete Plaid onboarding:', errorData);
        throw new Error(`Failed to complete Plaid onboarding: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Plaid onboarding successful:', result);

      accountPlaidConnItemAddOne(result.plaidConnectionItem);
    } catch (error) {
      console.error('Error during Plaid onboarding:', error);
    } finally {
      setLoading(false);
    }
  }, [state, accountPlaidConnItemAddOne]);

  const onExit = useCallback(() => {
    setLoading(false);
  }, []);

  const config: PlaidLinkOptions = {
    token: linkToken!,
    onSuccess: onSuccess,
    onExit: onExit
  };

  const { open, ready } = usePlaidLink(config);

  useEffect(() => {
    if (ready) {
      open();
    }
  }, [open, ready]);

  const createLinkToken = async () => {
    setLoading(true);

    if (!state?.account.budget?.id) {
      console.error('Budget ID not found');
      return;
    }
    try {
      const response = await fetch('/api/plaid/create-link-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ budgetId: state?.account.budget?.id, redirectType: 'account' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to create Plaid link token:', errorData);
        throw new Error(`Failed to create Plaid link token: ${response.status} ${response.statusText}`);
      }

      const { link_token } = await response.json();
      setLinkToken(link_token);
    } catch (error) {
      console.error('Error creating link token:', error);
      setLoading(false);
    }
  };

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

          <PlaidConnectionItems loading={loading} />

          <Button onClick={() => createLinkToken()} disabled={loading}>
            <Trans i18nKey={'onboarding:connectAccountsButtonLabel'} />
          </Button>
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
