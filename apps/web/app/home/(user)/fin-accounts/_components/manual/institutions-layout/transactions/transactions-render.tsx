'use client';

import { Dialog, DialogContent } from '@kit/ui/dialog';
import { useFinAccountsMgmtContext } from '~/components/fin-accounts-mgmt-context';
import CreateTransaction from '../../dialogs/transactions/create-transaction';
import TransactionsTable from './transactions-table';

export default function TransactionsRender() {
  const { state, accountTransactionsPanelSetSelectedAccount } = useFinAccountsMgmtContext();

  const selectedAccountId = state.account.transactions?.transactionsPanel?.selectedAccount;

  if (!selectedAccountId || !state.account.manualInstitutions) return null;

  const institution = state.account.manualInstitutions.find((inst) =>
    inst.accounts.some(acc => acc.id === selectedAccountId)
  );

  if (!institution) return null;

  const account = institution.accounts.find(acc => acc.id === selectedAccountId);

  if (!account) return null;

  return (
    <Dialog 
      open={!!selectedAccountId} 
      onOpenChange={(open) => {
        if (!open) accountTransactionsPanelSetSelectedAccount('');
      }}
    >
      <DialogContent className="max-w-[80vw]">
        <div className="flex w-full flex-col gap-4">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center">
              <p className="text-md font-semibold">
                {institution.symbol}
              </p>
              <span>&nbsp;&middot;&nbsp;</span>
              <p className="text-md capitalize">
                {account.name.length > 18
                  ? account.name.slice(0, 18) + '...'
                  : account.name}
              </p>
              <span>&nbsp;&middot;&nbsp;</span>
              <p className="text-sm capitalize">{account.type}</p>
              <span>&nbsp;&middot;&nbsp;</span>
              <p className="text-sm">****{account?.mask}</p>
            </div>
            <CreateTransaction
              manualAccount={account}
              institutionSymbol={institution.symbol}
            />
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <p className="text-sm">
              Balance: ${Number(account.balanceCurrent ?? 0).toFixed(2)}
            </p>
            <span>&nbsp;&middot;&nbsp;</span>
            <p className="text-sm">
              Transactions: {account.transactions?.length || 0}
            </p>
          </div>

          <div className="max-h-[60vh] overflow-auto">
            <TransactionsTable transactions={account.transactions} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
