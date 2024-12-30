import { Card } from '@kit/ui/card';
import { Switch } from '@kit/ui/switch';
import { Building } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useOnboardingContext } from '~/components/onboarding-context';
import { DeleteDialog } from '~/components/ui/dialogs/delete-dialog';
import { AccountOnboardingInstitution } from '~/lib/model/onboarding.types';
import { ItemDeleteDialog } from '../../../plaid/plaid-item-delete-dialog';
import CreateAccount from '../../dialogs/accounts/create-account';
import ManualAccountSkeleton from '../../manual-account-skeleton';
import UpdateInstitution from '../../dialogs/institutions/update-institution';
import UpdateAccount from '../../dialogs/accounts/update-account';

type Props = {
  institution: AccountOnboardingInstitution;
};

export default function InstitutionRender({ institution }: Props) {
  const {
    accountManualInstitutionsDeleteOne,
    accountManualInstitutionsLinkAccount,
    accountManualInstitutionsUnlinkAccount,
    accountManualAccountDeleteOne,
    accountTransactionsPanelSetSelectedAccount,
    state,
  } = useOnboardingContext();

  const [isLoading, setIsLoading] = useState<string | null>(null);

  const [isAddingAccount, setIsAddingAccount] = useState(false);

  async function handleDeleteManualInstitution() {
    try {
      const response = await fetch(
        `/api/onboarding/account/manual/institutions/${institution.id}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) throw new Error('Failed to delete manual account');

      accountManualInstitutionsDeleteOne(institution.id);
    } catch (err: any) {
      console.error(err);
    }
  }

  async function handleLinkAccount(
    accountId: string,
    isCurrentlyChecked: boolean,
  ) {
    // Optimistically update the UI
    const action = isCurrentlyChecked ? 'unlink_account' : 'link_account';
    
    if (isCurrentlyChecked) {
      accountManualInstitutionsUnlinkAccount(accountId);
    } else {
      // Use a temporary ID for optimistic update
      accountManualInstitutionsLinkAccount(accountId, 'pending');
    }

    try {
      const response = await fetch(
        `/api/onboarding/account/manual/accounts/${accountId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ action }),
        },
      );

      if (!response.ok) throw new Error('Failed to link/unlink account');

      const { budgetId } = await response.json();

      // If unlinking, we've already done it
      // If linking, update with real budgetId
      if (!isCurrentlyChecked) {
        accountManualInstitutionsLinkAccount(accountId, budgetId);
      }
    } catch (err: any) {
      console.error(err);
      // Revert the optimistic update
      if (isCurrentlyChecked) {
        accountManualInstitutionsLinkAccount(accountId, 'reverted');
      } else {
        accountManualInstitutionsUnlinkAccount(accountId);
      }
    }
  }

  async function handleDeleteAccount({ accountId }: { accountId: string }) {
    if (!!isLoading) return;

    try {
      setIsLoading(accountId);

      const response = await fetch(
        `/api/onboarding/account/manual/accounts/${accountId}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) throw new Error('Failed to delete account');

      accountManualAccountDeleteOne(accountId);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(null);
    }
  }

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
        {institution.accounts.map((acc) => {
          const isChecked = !!acc.budgetFinAccountId;

          return (
            <Card
              key={`account-${acc.id}-${institution.id}`}
              className={`group mt-3 flex w-full max-w-xl items-center justify-between border border-gray-600 px-4 py-[14px] ${state.account.transactions?.transactionsPanel?.selectedAccount === acc.id ? 'bg-muted-foreground/5' : ''}`}
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
                </div>
              </div>
              <div className="flex h-full translate-y-[4px] flex-col items-center justify-center gap-1">
                <Switch
                  checked={isChecked}
                  onCheckedChange={() => handleLinkAccount(acc.id, isChecked)}
                />
                <DeleteDialog
                  disabled={!!isLoading}
                  message="Are you sure you want to delete this account and all the transactions associated with it?"
                  onConfirm={() => handleDeleteAccount({ accountId: acc.id })}
                />
              </div>
            </Card>
          );
        })}
        {isAddingAccount ? <ManualAccountSkeleton /> : null}
      </div>
      <CreateAccount
        setIsAddingAccount={setIsAddingAccount}
        institution={institution}
      />
    </div>
  );
}
