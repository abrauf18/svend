import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kit/ui/tabs"
import TransactionTab from "~/home/[account]/manage/_components/transaction-tab";


function TransactionDashboard(props: { budgetId: string }) {

    return (
        <div className="w-full max-w-4xl mx-auto p-2">
            <Tabs defaultValue="transaction" className="w-full">
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
                <TabsContent value="recurring">recurring tab</TabsContent>
                <TabsContent value="budget">budget tab</TabsContent>
                <TabsContent value="goals">goals tab</TabsContent>
            </Tabs>
        </div>
    );
}

export default TransactionDashboard;
