'use client';

import { useFinAccountsMgmtContext } from '~/components/fin-accounts-mgmt-context';

export function AccountSummary() {
  const { state } = useFinAccountsMgmtContext();
  
  // Auto Import counts
  const autoImportStats = state.account.plaidConnectionItems?.reduce(
    (acc, item) => {
      const totalAccounts = item.itemAccounts.length;
      const linkedAccounts = item.itemAccounts.filter(
        account => account.budgetFinAccountIds?.length > 0
      ).length;
      return {
        total: acc.total + totalAccounts,
        linked: acc.linked + linkedAccounts
      };
    },
    { total: 0, linked: 0 }
  ) ?? { total: 0, linked: 0 };

  // Manual counts
  const manualStats = state.account.manualInstitutions?.reduce(
    (acc, inst) => {
      const totalAccounts = inst.accounts.length;
      const linkedAccounts = inst.accounts.filter(
        account => account.budgetFinAccountIds?.length > 0
      ).length;
      return {
        total: acc.total + totalAccounts,
        linked: acc.linked + linkedAccounts
      };
    },
    { total: 0, linked: 0 }
  ) ?? { total: 0, linked: 0 };

  return (
    <div className="flex flex-col gap-2 mb-6">
      {/* Auto Import row */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground w-24">Auto Import</span>
        <span className="text-xl font-semibold">{autoImportStats.linked}</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-xl font-semibold">{autoImportStats.total}</span>
        <span className="text-sm text-muted-foreground ml-2">accounts linked to budgets</span>
      </div>

      {/* Manual row */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground w-24">Manual</span>
        <span className="text-xl font-semibold">{manualStats.linked}</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-xl font-semibold">{manualStats.total}</span>
        <span className="text-sm text-muted-foreground ml-2">accounts linked to budgets</span>
      </div>
    </div>
  );
} 