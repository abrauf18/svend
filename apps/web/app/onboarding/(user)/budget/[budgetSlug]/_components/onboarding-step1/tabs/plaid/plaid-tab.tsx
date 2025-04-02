import { Button } from '@kit/ui/button';
import { useCallback, useEffect, useState } from 'react';
import { PlaidLinkOptions, usePlaidLink } from 'react-plaid-link';
import { PlaidConnectionItems } from './plaid-connection-items';
import { Trans } from '@kit/ui/trans';
import Image from 'next/image';
import { useBudgetOnboardingContext } from '~/components/budget-onboarding-context';

interface PlaidTabProps {
  loadingServer: boolean;
  setLoadingServer: (loading: boolean) => void;
  loadingPlaidOAuth: boolean;
  setLoadingPlaidOAuth: (loading: boolean) => void;
}

export function PlaidTab({ loadingServer, setLoadingServer, loadingPlaidOAuth, setLoadingPlaidOAuth }: PlaidTabProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const { state, accountPlaidConnItemAddOne, budgetSlug } = useBudgetOnboardingContext();

  const onSuccess = useCallback(
    async (public_token: string, metadata: any) => {
      try {
        const response = await fetch(`/api/onboarding/budget/${budgetSlug}/plaid/item`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            budgetId: state?.budget.budget?.id,
            plaidPublicToken: public_token,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Failed to complete Plaid onboarding:', errorData);
          throw new Error(
            `Failed to complete Plaid onboarding: ${response.status} ${response.statusText}`,
          );
        }

        const result = await response.json();
        console.log('Plaid onboarding successful:', result);

        accountPlaidConnItemAddOne(result.plaidConnectionItem);
        setLoadingPlaidOAuth(false);
      } catch (error) {
        console.error('Error during Plaid onboarding:', error);
        setLoadingPlaidOAuth(false);
      }
    },
    [state, accountPlaidConnItemAddOne],
  );

  const onExit = useCallback(() => {
    setLoadingPlaidOAuth(false);
  }, []);

  const config: PlaidLinkOptions = {
    token: linkToken!,
    onSuccess,
    onExit,
  };

  const { open, ready } = usePlaidLink(config);

  useEffect(() => {
    if (ready) {
      open();
    }
  }, [open, ready]);

  const createLinkToken = async () => {
    setLoadingPlaidOAuth(true);

    if (!state?.budget.budget?.id) {
      console.error('Budget ID not found');
      return;
    }
    try {
      const response = await fetch('/api/plaid/create-link-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          budgetId: state?.budget.budget?.id,
          redirectType: 'account',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to create Plaid link token:', errorData);
        throw new Error(
          `Failed to create Plaid link token: ${response.status} ${response.statusText}`,
        );
      }

      const { link_token } = await response.json();
      setLinkToken(link_token);
    } catch (error) {
      console.error('Error creating link token:', error);
      setLoadingPlaidOAuth(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className={`flex-1 flex flex-col overflow-hidden ${loadingServer ? 'pointer-events-none' : ''}`}>
        <div className="flex-1 min-h-0">
          <PlaidConnectionItems
            loadingPlaidOAuth={loadingPlaidOAuth}
            loadingServer={loadingServer}
            setLoadingServer={setLoadingServer}
            headerContent={
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex-shrink-0 p-2">
                  <Button 
                    onClick={() => createLinkToken()} 
                    disabled={loadingPlaidOAuth}
                  >
                    <Image
                      src="/images/plaid_logo.svg"
                      alt="Plaid Logo"
                      width={20}
                      height={20}
                      className="mr-2"
                    />
                    <Trans i18nKey={'onboarding:connectAccountsButtonLabel'} />
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground flex-1">
                  <Trans i18nKey={'onboarding:connectPlaidAccountsInstructionText'} />
                </div>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
} 