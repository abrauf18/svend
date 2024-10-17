import React from 'react';
import {Calendar, ChevronLeft, ChevronRight} from "lucide-react";
import {Trans} from "@kit/ui/trans";
import {Button} from "@kit/ui/button";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@kit/ui/select";
import {TransactionTable} from "~/home/[account]/manage/_components/transaction-tab-table";


function TransactionTab(props: { budgetId: string }) {

    return (
        <div className="w-full flex flex-col gap-4">
            <div className="max-w-full min-w-full flex flex-row items-center justify-between">
                <div className="flex flex-row items-center justify-between gap-2 font-normal w-[180px]">
                    <ChevronLeft className="h-4 w-4"/>
                    <div className="flex flex-row gap-1 items-center text-[14px]">
                        October 2024
                        <Calendar className="h-4 w-4"/>
                    </div>
                    <ChevronRight className="h-4 w-4"/>
                </div>

                <div className="flex flex-row gap-2 items-center">
                    <Button
                        variant={'outline'}
                    >
                        <Trans i18nKey={'common:transactionTabAddToGoalsBtn'} />
                    </Button>

                    <Select>
                        <SelectTrigger className="w-[180px]" id="transaction-type">
                            <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="income">Add to cash</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <TransactionTable budgetId={props.budgetId} />
        </div>
    );
}

export default TransactionTab;
