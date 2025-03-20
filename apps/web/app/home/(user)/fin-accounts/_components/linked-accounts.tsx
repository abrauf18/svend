'use client';

import React, { useEffect, useState } from 'react';
import { useFinAccountsMgmtContext } from '~/components/fin-accounts-mgmt-context';

export function LinkedAccounts() {
    const { state } = useFinAccountsMgmtContext();
    const [counts, setCounts] = useState({
        plaidLinked: 0,
        plaidUnlinked: 0,
        manualLinked: 0,
        manualUnlinked: 0
    });

    useEffect(() => {
        const plaidLinkedCount = state?.account.budgets?.flatMap(budget => 
            budget.linkedFinAccounts ?? []
        ).filter(account => account.source === 'plaid').length ?? 0;

        const plaidUnlinkedCount = state?.account.plaidConnectionItems?.reduce((acc, item) => 
            acc + (item.itemAccounts?.filter(account => 
                !account.budgetFinAccountIds?.length
            ).length ?? 0), 0
        ) ?? 0;

        const manualLinkedCount = state?.account.budgets?.flatMap(budget => 
            budget.linkedFinAccounts ?? []
        ).filter(account => account.source === 'svend').length ?? 0;

        const manualUnlinkedCount = state?.account.manualInstitutions?.reduce((acc, institution) => 
            acc + (institution.accounts?.filter(account => 
                !account.budgetFinAccountIds?.length
            ).length ?? 0), 0
        ) ?? 0;

        setCounts({
            plaidLinked: plaidLinkedCount,
            plaidUnlinked: plaidUnlinkedCount,
            manualLinked: manualLinkedCount,
            manualUnlinked: manualUnlinkedCount
        });
    }, [
        state?.account.budgets,
        state?.account.plaidConnectionItems,
        state?.account.manualInstitutions
    ]);

    return (
        <div className="flex items-center gap-4">
            <div className="flex items-center space-x-3">
                <span className="text-base text-muted-foreground">Auto Import</span>
                <div
                    className={`flex h-6 w-7 items-center justify-center rounded-sm border ${
                        counts.plaidLinked === 0 
                            ? 'border-muted-foreground text-muted-foreground' 
                            : 'border-primary bg-primary font-semibold text-primary-foreground'
                    }`}
                >
                    {counts.plaidLinked}
                </div>
                <div className="!ml-0 text-sm text-muted-foreground bg-muted h-6 w-7 flex items-center justify-center rounded-sm border">
                    {counts.plaidUnlinked}
                </div>
            </div>
            <div className="ml-6 flex items-center space-x-3">
                <span className="text-base text-muted-foreground">Manual</span>
                <div
                    className={`flex h-6 w-7 items-center justify-center rounded-sm border ${
                        counts.manualLinked === 0 
                            ? 'border-muted-foreground text-muted-foreground' 
                            : 'border-primary bg-primary font-semibold text-primary-foreground'
                    }`}
                >
                    {counts.manualLinked}
                </div>
                <div className="!ml-0 text-sm text-muted-foreground bg-muted h-6 w-7 flex items-center justify-center rounded-sm border">
                    {counts.manualUnlinked}
                </div>
            </div>
        </div>
    );
}

export default LinkedAccounts;
