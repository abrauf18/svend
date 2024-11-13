'use client';
import React from 'react';
import {Calendar, ChevronLeft, ChevronRight} from "lucide-react";
import {Trans} from "@kit/ui/trans";
import {Button} from "@kit/ui/button";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@kit/ui/select";
import {TransactionTable} from "~/home/[account]/manage/_components/transaction-tab-table";
import TransactionOverview from "~/home/[account]/manage/_components/transaction-overview";
import {TransactionPanel} from "~/home/[account]/manage/_components/edit-transaction-panel";
import {Transaction} from "~/home/[account]/manage/_components/transaction-tab-table";



function TransactionTab(props: { budgetId: string }) {
    const [isPanelOpen, setIsPanelOpen] = React.useState(false)
    const [selectedTransaction, setSelectedTransaction] = React.useState<Transaction | undefined>(undefined)
    const [selectedRowData, setSelectedRowData] = React.useState<Transaction | undefined>(undefined);
    const [refreshTrigger, setRefreshTrigger] = React.useState(0);

    const handlePanelClose = (open: boolean) => {
        setIsPanelOpen(open);
        if (!open) {
            setRefreshTrigger(prev => prev + 1);
        }
    };

    return (
        <>
            <div className="w-full flex flex-col lg:flex-row">
                <div className="flex-grow overflow-hidden">
                    <div className="w-full flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
                            <div className="flex flex-row items-center justify-between gap-2 font-normal w-[180px]">
                                <ChevronLeft className="h-4 w-4" />
                                <div className="flex flex-row gap-1 items-center text-[14px]">
                                    October 2024
                                    <Calendar className="h-4 w-4" />
                                </div>
                                <ChevronRight className="h-4 w-4" />
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full sm:w-auto">
                                <Button variant="outline" className="w-full sm:w-auto">
                                    <Trans i18nKey="common:transactionTabAddToGoalsBtn" />
                                </Button>

                                <Select>
                                    <SelectTrigger className="w-full sm:w-[180px]" id="transaction-type">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="income">Add to cash</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="overflow-auto">
                            <TransactionTable
                                budgetId={props.budgetId}
                                onSelectedTransaction={setSelectedTransaction}
                                onOpenChange={setIsPanelOpen}
                                onSelectedRowData={setSelectedRowData}
                                refreshTrigger={refreshTrigger}
                            />
                        </div>
                    </div>
                </div>

                <div className="w-full lg:w-[300px] flex-shrink-0 p-4">
                    <TransactionOverview />
                </div>
            </div>
            <TransactionPanel
                open={isPanelOpen}
                onOpenChange={handlePanelClose}
                transaction={selectedTransaction}
                selectedRowData={selectedRowData}
                disabledFields={
                    {
                        date: true,
                        category: false,
                        payee: false,
                        notes: false,
                        amount: true,
                        recurring: false,
                        account: true,
                        attachments: false,
                    }
                }
            />
        </>
    );
}

export default TransactionTab;
