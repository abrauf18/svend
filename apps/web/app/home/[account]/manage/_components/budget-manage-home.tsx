'use client';

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kit/ui/tabs"
import TransactionTab from "~/home/[account]/manage/_components/tabs/transactions/transaction-tab";
import RecurringTab from "~/home/[account]/manage/_components/tabs/transactions-recurring/transactions-recurring-tab";
import GoalsTab from "~/home/[account]/manage/_components/tabs/goals/goals-tab";
import BudgetTab from './tabs/budget/budget-tab';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@kit/ui/alert-dialog"

function BudgetManageHome() {
    const [activeTab, setActiveTab] = useState("transaction");
    const [isTabDirty, setIsTabDirty] = useState(false);
    const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

    // Only handle browser refresh/close with native dialog
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isTabDirty) {
                e.preventDefault();
                // e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isTabDirty]);

    // Handle tab changes
    const handleTabChange = (value: string) => {
        if (isTabDirty) {
            setPendingNavigation(() => () => setActiveTab(value));
            setShowUnsavedChangesDialog(true);
        } else {
            setActiveTab(value);
        }
    };

    const handleConfirmNavigation = () => {
        setIsTabDirty(false);
        setShowUnsavedChangesDialog(false);
        if (pendingNavigation) {
            pendingNavigation();
            setPendingNavigation(null);
        }
    };

    return (
        <>
            <div className="flex-1 flex flex-col w-full mx-auto p-2">
                <Tabs 
                    value={activeTab} 
                    onValueChange={handleTabChange} 
                    className="w-full flex-1 flex flex-col items-start"
                >
                    <TabsList className="h-[58px] bg-background p-1">
                        <TabsTrigger value="transaction" className="h-[48px] rounded-md data-[state=active]:bg-green-300 data-[state=active]:text-primary-foreground">
                            Transaction
                        </TabsTrigger>
                        <TabsTrigger value="recurring" className="h-[48px] rounded-md data-[state=active]:bg-green-300 data-[state=active]:text-primary-foreground">
                            Recurring
                        </TabsTrigger>
                        <TabsTrigger value="budget" className="h-[48px] rounded-md data-[state=active]:bg-green-300 data-[state=active]:text-primary-foreground">
                            Budget
                        </TabsTrigger>
                        <TabsTrigger value="goals" className="h-[48px] rounded-md data-[state=active]:bg-green-300 data-[state=active]:text-primary-foreground">
                            Goals
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="budget">
                        <BudgetTab onDirtyStateChange={setIsTabDirty} />
                    </TabsContent>
                    <TabsContent value="transaction" className="w-full">
                        <TransactionTab />
                    </TabsContent>
                    <TabsContent value="recurring" className="w-full">
                        <RecurringTab />
                    </TabsContent>
                    <TabsContent value="goals" className="w-full">
                        <GoalsTab />
                    </TabsContent>
                </Tabs>
            </div>

            <AlertDialog 
                open={showUnsavedChangesDialog} 
                onOpenChange={setShowUnsavedChangesDialog}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
                        <AlertDialogDescription>
                            You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setShowUnsavedChangesDialog(false);
                            setPendingNavigation(null);
                        }}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleConfirmNavigation}
                            className="bg-orange-500 hover:bg-orange-600"
                        >
                            Leave Without Saving
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

export default BudgetManageHome;
