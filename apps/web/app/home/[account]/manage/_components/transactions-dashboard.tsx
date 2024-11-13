import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kit/ui/tabs"
import TransactionTab from "~/home/[account]/manage/_components/transaction-tab";
import RecurringTab from "~/home/[account]/manage/_components/recurring-tab";
import GoalsTab from "~/home/[account]/manage/_components/goals-tab";


function TransactionDashboard(props: { budgetId: string }) {

    return (
        <div className="flex-1 flex flex-col w-full mx-auto p-2">
            <Tabs defaultValue="transaction" className="w-full flex-1 flex flex-col items-start">
                <TabsList className="h-[58px] bg-background p-1">
                    <TabsTrigger
                        value="transaction"
                        className="h-[48px] rounded-md data-[state=active]:bg-green-300 data-[state=active]:text-primary-foreground"
                    >
                        Transaction
                    </TabsTrigger>
                    <TabsTrigger
                        value="recurring"
                        className="h-[48px] rounded-md data-[state=active]:bg-green-300 data-[state=active]:text-primary-foreground"
                    >
                        Recurring
                    </TabsTrigger>
                    <TabsTrigger
                        value="budget"
                        className="h-[48px] rounded-md data-[state=active]:bg-green-300 data-[state=active]:text-primary-foreground"
                    >
                        Budget
                    </TabsTrigger>
                    <TabsTrigger
                        value="goals"
                        className="h-[48px] rounded-md data-[state=active]:bg-green-300 data-[state=active]:text-primary-foreground"
                    >
                        Goals
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="transaction" className="w-full">
                    <TransactionTab budgetId={props.budgetId} />
                </TabsContent>
                <TabsContent value="recurring" className="w-full">
                    <RecurringTab budgetId={props.budgetId} />
                </TabsContent>
                <TabsContent value="budget">budget tab</TabsContent>
                <TabsContent value="goals" className="w-full">
                    <GoalsTab budgetId={props.budgetId} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default TransactionDashboard;
