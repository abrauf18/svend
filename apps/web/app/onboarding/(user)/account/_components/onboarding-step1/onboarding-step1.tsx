import { useOnboardingContext } from '@kit/accounts/components';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@kit/ui/card';
import { Progress } from '@kit/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { Trans } from '@kit/ui/trans';
import { Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { PlaidTab } from './tabs/plaid/plaid-tab';
import { ManualTab } from './tabs/manual/manual-tab';
import { AccountOnboardingStepContextKey } from '~/lib/model/onboarding.types';
import { FinAccount } from '~/lib/model/fin.types';
import { AccountOnboardingState } from '~/lib/model/onboarding.types';
import { toast } from 'sonner';

function OnboardingStep1ConnectPlaidAccounts() {
  const [loadingPlaidOAuth, setLoadingPlaidOAuth] = useState(false);
  const [loadingServer, setLoadingServer] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'plaid' | 'manual' | undefined>(undefined);
  const [isPlaidValid, setIsPlaidValid] = useState(false);
  const [isManualValid, setIsManualValid] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [plaidLinkedCount, setPlaidLinkedCount] = useState(0);
  const [manualLinkedCount, setManualLinkedCount] = useState(0);
  const {
    accountNextStep,
    accountSetStepContext,
    accountBudgetSetLinkedFinAccounts,
    accountSetPlaidItemTransactions,
    state
  } = useOnboardingContext();

  useEffect(() => {
    const manualAccountsWithTransactions = state?.account.manualInstitutions?.flatMap(
      institution => institution.accounts?.filter(
        account => account.budgetFinAccountId && account.transactions?.length > 0
      )
    ) ?? [];

    setManualLinkedCount(manualAccountsWithTransactions.length);
    setIsManualValid(manualAccountsWithTransactions.length > 0);

    const plaidLinkedAccounts = state?.account.plaidConnectionItems?.flatMap(
      item => item.itemAccounts.filter(account => !!account.budgetFinAccountId)
    ) ?? [];
    setPlaidLinkedCount(plaidLinkedAccounts.length);
    setIsPlaidValid(plaidLinkedAccounts.length > 0);

    // Either tab being valid makes the form valid
    setIsFormValid(isPlaidValid || isManualValid);

    if (selectedTab === undefined) {
      if (['start', 'plaid'].includes(state.account.contextKey as string)) {
        setSelectedTab('plaid');
      } else {
        setSelectedTab('manual');
      }
    }
  }, [state?.account.plaidConnectionItems, state?.account.manualInstitutions]);

  useEffect(() => {
    setIsFormValid(isPlaidValid || isManualValid);
  }, [isPlaidValid, isManualValid]);

  useEffect(() => {
    // Don't update context until state is fully loaded and validation is complete
    if (!state?.account || state.account.contextKey === undefined || manualLinkedCount === undefined) {
      return;
    }

    // Skip updates if we're transitioning to next step
    if (state.account.contextKey === 'profile_goals') {
      return;
    }

    // Don't update context until selectedTab is initialized
    if (selectedTab === undefined) {
      return;
    }

    const currentContextKey = state.account.contextKey;
    let newContextKey = currentContextKey;

    if (isPlaidValid && !isManualValid && currentContextKey !== 'plaid') {
      newContextKey = 'plaid';
    } else if (!isPlaidValid && isManualValid && currentContextKey !== 'manual') {
      newContextKey = 'manual';
    } else if (isPlaidValid && isManualValid && currentContextKey !== selectedTab) {
      // Case 3: Both are valid, use selected tab
      newContextKey = selectedTab!;
    } else if (!isPlaidValid && !isManualValid && currentContextKey !== 'start') {
      // Case 4: Neither is valid
      newContextKey = 'start';
    }

    // Add debounce to prevent rapid updates
    const timeoutId = setTimeout(() => {
      if (newContextKey !== currentContextKey) {
        void updateContextKey(newContextKey, [currentContextKey, newContextKey]);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [state?.account, isPlaidValid, isManualValid, selectedTab, manualLinkedCount]);

  useEffect(() => {
    if (!state.account) return;
    const allLinkedAccounts = createLinkedFinAccounts(state.account);
    accountBudgetSetLinkedFinAccounts(allLinkedAccounts as FinAccount[]);
  }, [state.account.plaidConnectionItems, state.account.manualInstitutions]);

  async function updateContextKey(contextKey: string, validContextKeys: string[]) {
    // Skip if we're trying to update to the same context key
    if (state.account.contextKey === contextKey) {
      return;
    }

    try {
      const response = await fetch('/api/onboarding/account/state', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contextKey: contextKey,
          validContextKeys: validContextKeys
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Error updating context:', error);
        return;
      }

      // If API call succeeded, update client state with the context key unless proceeding to next step
      if (contextKey !== 'profile_goals') {
        accountSetStepContext(contextKey as AccountOnboardingStepContextKey);
      }
    } catch (error) {
      console.error('Error updating context:', error);
    }
  }

  const createLinkedFinAccounts = useCallback((state: AccountOnboardingState) => {
    // Get Plaid accounts
    const linkedFinAccounts = state?.plaidConnectionItems?.flatMap(item =>
      item.itemAccounts
        .filter(account => account.budgetFinAccountId)
        .map(account => ({
          id: account.svendAccountId,
          source: 'plaid' as const,
          institutionName: item.institutionName,
          budgetFinAccountId: account.budgetFinAccountId,
          name: account.accountName,
          mask: account.mask,
          officialName: account.officialName,
          balance: account.balanceCurrent
        }))
    ) ?? [];

    // Get manual accounts
    const manualAccounts = state?.manualInstitutions?.flatMap(inst =>
      inst.accounts
        .filter(account => account.budgetFinAccountId)
        .map(account => ({
          id: account.id,
          source: 'svend' as const,
          institutionName: inst.name,
          budgetFinAccountId: account.budgetFinAccountId,
          name: account.name,
          mask: account.mask || '',
          officialName: account.name,
          balance: account.balanceCurrent
        }))
    ) ?? [];

    // Combine and sort
    return [...linkedFinAccounts, ...manualAccounts]
      .filter(account => account.budgetFinAccountId)
      .sort((a, b) => {
        if (a.source !== b.source) {
          return a.source === 'plaid' ? -1 : 1;
        }
        if (a.institutionName !== b.institutionName) {
          return a.institutionName.localeCompare(b.institutionName);
        }
        return a.name.localeCompare(b.name);
      });
  }, []);

  async function syncManualTransactions(state: AccountOnboardingState) {
    // Get manual accounts that are linked to budget
    const manualAccounts = state?.manualInstitutions?.flatMap(inst =>
      inst.accounts
        .filter(account => account.budgetFinAccountId)
        .map(account => ({
          id: account.id,
          budgetFinAccountId: account.budgetFinAccountId
        }))
    ) ?? [];

    // If no manual accounts are linked, skip sync
    if (!manualAccounts.length) return;

    // Sync transactions for each manual account
    for (const account of manualAccounts) {
      try {
        await fetch('/api/onboarding/account/manual/transactions', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            budgetId: state.budget.id,
            manualAccountId: account.id
          }),
        });
      } catch (error) {
        console.error('Error syncing transactions for account:', account.id, error);
      }
    }
  }

  async function syncPlaidTransactions(state: AccountOnboardingState) {
    if (!state?.plaidConnectionItems?.length) return;

    try {
      const response = await fetch('/api/onboarding/account/plaid/transactions', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sync Plaid transactions');
      }

      const result = await response.json();
      
      accountSetPlaidItemTransactions(result.newTransactions || []);
    } catch (error) {
      console.error('Error syncing Plaid transactions:', error);
      throw error; // Re-throw the error so Promise.allSettled can catch it
    }
  }

  async function handleNext() {
    if (!state.account.budget.id) return;

    setIsNavigating(true);

    try {
      // Track which syncs need to run
      const needsManualSync = state.account.manualInstitutions?.some(
        inst => inst.accounts.some(acc => acc.budgetFinAccountId)
      ) ?? false;
      
      const needsPlaidSync = state.account.plaidConnectionItems?.length ?? 0 > 0;

      // Run syncs in parallel if needed
      const syncResults = await Promise.allSettled([
        needsManualSync ? syncManualTransactions(state.account) : Promise.resolve(),
        needsPlaidSync ? syncPlaidTransactions(state.account) : Promise.resolve()
      ]);

      // Check for failures in syncs that were attempted
      const syncFailures = syncResults.map((result, index) => {
        if (result.status === 'rejected') {
          return index === 0 ? 'manual' : 'plaid';
        }
        return null;
      }).filter(Boolean);

      if (syncFailures.length > 0) {
        console.error('Sync failures:', syncFailures);
        toast.error(`Failed to sync ${syncFailures.join(' and ')} transactions. Please try again.`);
        setIsNavigating(false);
        return;
      }

      await updateContextKey('profile_goals', [state.account.contextKey as string, 'profile_goals']);

      // Only proceed if all required syncs succeeded
      accountNextStep();
    } catch (error) {
      console.error('Error in handleNext:', error);
      toast.error('An unexpected error occurred. Please try again.');
      setIsNavigating(false);
    }
  }

  return (
    <div className="mx-auto h-[calc(100vh-6rem)] w-full max-w-6xl">
      <Card className="flex h-full w-full flex-col">
        <CardHeader className="flex-shrink-0 space-y-4">
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

        <CardContent
          id="onboarding-step-1-parent"
          className="flex flex-1 flex-col space-y-4 overflow-hidden"
        >
          <div className={`flex items-center gap-4 my-2`}>
            <Tabs
              value={selectedTab}
              onValueChange={(value) =>
                setSelectedTab(value as 'plaid' | 'manual')
              }
              className={`flex flex-col items-start border rounded-lg overflow-hidden ${loadingServer || loadingPlaidOAuth ? 'pointer-events-none' : ''}`}
            >
              <TabsList className="h-[58px] w-full bg-muted px-1">
                <TabsTrigger
                  value="plaid"
                  className="h-[48px] w-[120px] rounded-md data-[state=active]:bg-green-300 data-[state=active]:text-primary-foreground"
                >
                  Auto Import
                </TabsTrigger>
                <TabsTrigger
                  value="manual"
                  className="h-[48px] w-[120px] rounded-md data-[state=active]:bg-green-300 data-[state=active]:text-primary-foreground"
                >
                  Manual
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="max-w-md text-sm text-foreground">
              <Trans i18nKey={'onboarding:connectAccountsInstructionText'} />
            </p>
          </div>
          <div className="flex-grow space-y-4">
            <div className={selectedTab === 'plaid' ? 'block' : 'hidden'}>
              <PlaidTab
                loadingServer={loadingServer}
                setLoadingServer={setLoadingServer}
                loadingPlaidOAuth={loadingPlaidOAuth}
                setLoadingPlaidOAuth={setLoadingPlaidOAuth}
              />
            </div>
            <div className={selectedTab === 'manual' ? 'block' : 'hidden'}>
              <ManualTab />
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex-shrink-0 border-t pt-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              className={`${(loadingServer || loadingPlaidOAuth) ? 'pointer-events-none' : ''}`}
              disabled={!isFormValid || isNavigating || loadingPlaidOAuth}
              onClick={async () => {
                setIsNavigating(true);
                handleNext();
              }}
            >
              {isNavigating ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <Trans i18nKey={'onboarding:connectAccountsNextButtonSavingLabel'} />
                </span>
              ) : (
                <Trans i18nKey={'onboarding:connectAccountsNextButtonLabel'} />
              )}
            </Button>

            <div className="flex items-center space-x-3 ml-6">
              <span className="text-base text-muted-foreground">Auto Import</span>
              <div className={`flex h-6 w-7 items-center justify-center rounded-sm border ${plaidLinkedCount === 0 ? 'border-muted-foreground text-muted-foreground' : 'border-primary bg-primary text-primary-foreground font-semibold'}`}>
                {plaidLinkedCount}
              </div>
            </div>
            <div className="flex items-center space-x-3 ml-6">
              <span className="text-base text-muted-foreground">Manual</span>
              <div className={`flex h-6 w-7 items-center justify-center rounded-sm border ${manualLinkedCount === 0 ? 'border-muted-foreground text-muted-foreground' : 'border-primary bg-primary text-primary-foreground font-semibold'}`}>
                {manualLinkedCount}
              </div>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export default OnboardingStep1ConnectPlaidAccounts;
