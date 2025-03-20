'use client';

import { Card } from '@kit/ui/card';
import { Building, ChevronDown, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useFinAccountsMgmtContext } from '~/components/fin-accounts-mgmt-context';
import { DeleteDialog } from '~/components/ui/dialogs/delete-dialog';
import { AccountOnboardingManualInstitution } from '~/lib/model/onboarding.types';
import CreateAccount from '../../dialogs/accounts/create-account';
import ManualAccountSkeleton from '../../manual-account-skeleton';
import UpdateInstitution from '../../dialogs/institutions/update-institution';
import UpdateAccount from '../../dialogs/accounts/update-account';
import { ItemDeleteDialog } from '~/onboarding/(user)/account/_components/onboarding-step1/tabs/plaid/plaid-item-delete-dialog';
import { Badge } from '@kit/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Button } from '@kit/ui/button';
import { Switch } from '@kit/ui/switch';
import { toast } from 'sonner';

type Props = {
  institution: AccountOnboardingManualInstitution;
};

export default function InstitutionRender({ institution }: Props) {
  const {
    accountManualInstitutionsDeleteOne,
    accountManualAccountDeleteOne,
    accountTransactionsPanelSetSelectedAccount,
    state,
    accountManualInstitutionsLinkAccount,
    accountManualInstitutionsUnlinkAccount,
  } = useFinAccountsMgmtContext();

  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [isAddingAccount, setIsAddingAccount] = useState(false);

  const currentBudget = state.account.budgets?.[0];
  const budgetId = currentBudget?.id;
  const budgetType = currentBudget?.budgetType;
  const linkedAccounts = currentBudget?.linkedFinAccounts ?? [];

  async function handleDeleteManualInstitution() {
    // Check if any account in this institution is linked to a goal
    const accountsWithGoals = institution.accounts.filter(account => 
      currentBudget?.goals.some(goal => goal.manualAccountId === account.id)
    );
    
    if (accountsWithGoals.length > 0) {
      const accountNames = accountsWithGoals.map(account => account.name).join(', ');
      toast.error(`Cannot delete this institution because account "${accountNames}" is currently associated with one or more goals in a linked budget.`);
      return;
    }

    try {
      const response = await fetch(
        `/api/fin-account-mgmt/manual/institutions/${institution.id}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) throw new Error('Failed to delete manual account');

      accountManualInstitutionsDeleteOne(institution.id);
    } catch (err: any) {
      console.error(err);
      toast.error('Error deleting institution. Please try again.');
    }
  }

  async function handleDeleteAccount({ accountId }: { accountId: string }) {
    if (isLoading) return;

    // Check if this account is linked to a goal
    const isLinkedToGoal = currentBudget?.goals.some(
      goal => goal.manualAccountId === accountId
    );
    
    if (isLinkedToGoal) {
      const account = institution.accounts.find(acc => acc.id === accountId);
      toast.error(`Cannot delete account "${account?.name}" because it is currently associated with one or more goals in a linked budget.`);
      return;
    }

    try {
      setIsLoading(accountId);

      const response = await fetch(
        `/api/fin-account-mgmt/manual/accounts/${accountId}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) throw new Error('Failed to delete account');

      accountManualAccountDeleteOne(accountId);
    } catch (err: any) {
      console.error(err);
      toast.error('Error deleting account. Please try again.');
    } finally {
      setIsLoading(null);
    }
  }

  const handleToggleBudgetLinking = async (accountId: string, checked: boolean) => {
    if (isLoading || !budgetId) return;

    // If we're trying to unlink, check if the account is linked to a goal
    if (!checked) {
      const isLinkedToGoal = currentBudget?.goals.some(
        goal => goal.manualAccountId === accountId
      );
      
      if (isLinkedToGoal) {
        const account = institution.accounts.find(acc => acc.id === accountId);
        toast.error(`Cannot unlink account "${account?.name}" because it is currently associated with one or more goals in a linked budget.`);
        return;
      }
    }

    try {
      setIsLoading(accountId);

      const response = await fetch(
        `/api/fin-account-mgmt/manual/accounts/${accountId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: checked ? 'link_account' : 'unlink_account',
            budgetId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(checked ? 'Failed to link account' : 'Failed to unlink account');
      }

      if (checked) {
        accountManualInstitutionsLinkAccount(accountId, budgetId);
      } else {
        accountManualInstitutionsUnlinkAccount(accountId);
      }
    } catch (error) {
      console.error('Error toggling budget link:', error);
      toast.error(checked ? 'Error linking account' : 'Error unlinking account');
    } finally {
      setIsLoading(null);
    }
  };

  // Helper function to check if account is linked
  const isAccountLinked = (accountId: string) => {
    return linkedAccounts.some(account => account.id === accountId);
  };

  return (
    <div className="w-full flex-shrink-0 space-y-4 rounded-lg border border-primary p-6">
      <div className="flex items-center justify-between rounded-lg border border-gray-600 p-4">
        <div className="flex items-center gap-2 text-[16px] font-semibold">
          <p className="flex items-center gap-2">
            <span
              className={`block max-w-[20ch] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap`}
            >
              {institution.name}
            </span>{' '}
            &middot; {institution.symbol}
          </p>
          <UpdateInstitution institution={institution} />
        </div>

        <ItemDeleteDialog onConfirm={handleDeleteManualInstitution} />
      </div>
      <div className="mt-2 pl-4">
        {institution.accounts.map((acc) => (
          <Card
            key={`account-${acc.id}-${institution.id}`}
            className={`group mt-3 flex w-full items-center justify-between border border-gray-600 px-4 py-[14px] ${state.account.transactions?.transactionsPanel?.selectedAccount === acc.id ? 'bg-muted-foreground/5' : ''}`}
          >
            <div className="flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded bg-primary">
                <Building className="h-8 w-8 text-black" />
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h2 className="text-primary-800 max-w-[13ch] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-xl font-semibold">
                    {acc.name}
                  </h2>
                  <UpdateAccount account={acc} institution={institution} />
                </div>
                <button
                  onClick={() =>
                    accountTransactionsPanelSetSelectedAccount(acc.id)
                  }
                  className="flex items-center gap-1 text-left text-sm text-primary/70 underline transition-colors duration-300 hover:text-primary"
                >
                  <span
                    className={`block max-w-[15ch] overflow-hidden text-ellipsis whitespace-nowrap capitalize`}
                  >
                    {acc.type}
                  </span>{' '}
                  &middot; <span>****{acc.mask}</span>
                </button>
                <div className="text-sm text-muted-foreground mt-1">
                  ${acc.balanceCurrent?.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  }) ?? '0.00'}
                </div>
                {isAccountLinked(acc.id) && (
                  <div className="mt-2">
                    <div className="text-sm text-muted-foreground">
                      Connected budgets: {linkedAccounts.filter(a => a.id === acc.id).length}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Manage Budgets
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]" sideOffset={5}>
                  <DropdownMenuItem 
                    className="flex items-center justify-between"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <span>{currentBudget?.name}</span>
                    {isLoading === acc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Switch 
                        checked={isAccountLinked(acc.id)}
                        onCheckedChange={(checked) => handleToggleBudgetLinking(acc.id, checked)}
                      />
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DeleteDialog
                disabled={!!isLoading}
                message="Are you sure you want to delete this account and all the transactions associated with it?"
                onConfirm={() => handleDeleteAccount({ accountId: acc.id })}
              />
            </div>
          </Card>
        ))}
        {isAddingAccount ? <ManualAccountSkeleton /> : null}
      </div>
      <CreateAccount
        setIsAddingAccount={setIsAddingAccount}
        institution={institution}
      />
    </div>
  );
}
