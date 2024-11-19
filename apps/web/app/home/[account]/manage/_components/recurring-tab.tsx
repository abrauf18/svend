'use client';

import React from 'react';
import {Calendar, ChevronLeft, ChevronRight} from "lucide-react";
import RecurringOverview from "~/home/[account]/manage/_components/recurring-overview";
import {RecurringTable} from "~/home/[account]/manage/_components/recurring-tab-table";
import { useBudgetWorkspace } from '~/components/budget-workspace-context';


function RecurringTab() {
    const { workspace } = useBudgetWorkspace();
    const budgetId = workspace.budget.id;

    return (
        <div className="w-full flex flex-row">
            <div className="flex-grow overflow-hidden">
                <div className="w-full flex flex-col gap-4">
                    <div className="flex flex-row items-center justify-between">
                        <div className="flex flex-row items-center justify-between gap-2 font-normal w-[180px]">
                            <ChevronLeft className="h-4 w-4" />
                            <div className="flex flex-row gap-1 items-center text-[14px]">
                                October 2024
                                <Calendar className="h-4 w-4" />
                            </div>
                            <ChevronRight className="h-4 w-4" />
                        </div>
                    </div>

                    <div className="overflow-auto">
                        <RecurringTable />
                    </div>
                </div>
            </div>

            <div className="w-[300px] flex-shrink-0 p-4">
                <RecurringOverview />
            </div>
        </div>
    );
}

export default RecurringTab;
