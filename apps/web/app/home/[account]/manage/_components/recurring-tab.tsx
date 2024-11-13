import React from 'react';
import {Calendar, ChevronLeft, ChevronRight} from "lucide-react";
import {Trans} from "@kit/ui/trans";
import {Button} from "@kit/ui/button";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@kit/ui/select";
import RecurringOverview from "~/home/[account]/manage/_components/recurring-overview";
import {RecurringTable} from "~/home/[account]/manage/_components/recurring-tab-table";


function RecurringTab(props: { budgetId: string }) {

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
                        <RecurringTable budgetId={props.budgetId} />
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
