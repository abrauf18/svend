import { useEffect, useState } from 'react';
import { useOnboardingContext } from '~/components/onboarding-context';
import CreateTransaction from '../../dialogs/transactions/create-transaction';
import TransactionsTable from './transactions-table';

export default function TransactionsRender() {
  const { state } = useOnboardingContext();

  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && containerHeight === 0) {
      const container = document.querySelector('#onboarding-step-1-parent');

      if (!container) return;

      setContainerHeight(container.clientHeight - 42);
    }
  }, [window]);

  if (
    !state.account.transactions?.transactionsPanel?.selectedAccount ||
    !state.account.manualInstitutions
  )
    return null;

  const institution = state.account.manualInstitutions.find((inst) =>
    inst.accounts.some(
      (acc) =>
        acc.id ===
        state.account.transactions?.transactionsPanel?.selectedAccount,
    ),
  );

  if (!institution) return null;

  const account = institution.accounts.find(
    (acc) =>
      acc.id === state.account.transactions?.transactionsPanel?.selectedAccount,
  );

  if (!account) return null;

  return (
    <div
      className={`sticky top-[20px] flex w-full flex-col gap-1 rounded-lg border px-4 py-2 h-[calc(99vh-480px)]`}
    >
      <div className={`flex w-full items-center justify-between`}>
        <div className="flex items-center">
          <p className={`text-md font-semibold`}>
            {institution.symbol}
          </p>
          <span>&nbsp;&middot;&nbsp;</span>
          <p className={`text-md capitalize`}>
            {account.name.length > 18
              ? account.name.slice(0, 18) + '...'
              : account.name}
          </p>
          <span>&nbsp;&middot;&nbsp;</span>
          <p className={`text-sm capitalize`}>****{account?.mask}</p>
        </div>
        <CreateTransaction
          manualAccount={account}
          institutionSymbol={institution.symbol}
        />
      </div>
      <div className={`flex items-center gap-2 text-muted-foreground`}>
        <p className={`text-sm`}>
          Balance: ${Number(account.balanceCurrent ?? 0).toFixed(2)}
        </p>
        <span>&nbsp;&middot;&nbsp;</span>
        <p className={`text-sm`}>
          Transactions: {account.transactions?.length || 0}
        </p>
      </div>
      <TransactionsTable transactions={account.transactions} />
    </div>
  );
}
