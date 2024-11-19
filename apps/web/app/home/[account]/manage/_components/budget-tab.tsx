'use client';

import React from 'react';
import { useBudgetWorkspace } from '~/components/budget-workspace-context';

function BudgetTab() {
    const { workspace } = useBudgetWorkspace();
    const budgetId = workspace.budget.id;

    return (
        <>
            <div>Budget Tab</div>
        </>
    );
}

export default BudgetTab;
