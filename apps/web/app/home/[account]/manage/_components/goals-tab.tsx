'use client';
import React from 'react';
import {Calendar, ChevronLeft, ChevronRight} from "lucide-react";
import {Trans} from "@kit/ui/trans";
import {Button} from "@kit/ui/button";
import {GaolsTable} from "~/home/[account]/manage/_components/goals-tab-table";
import GoalsOverview from "~/home/[account]/manage/_components/goals-overview";
import {Card, CardContent, CardHeader} from "@kit/ui/card";

interface Goal {
    name: string
    progress: number
    type: string
}

const goals: Goal[] = [
    {
        name: "Buy BMW",
        progress: 2.50,
        type: "Savings"
    },
    {
        name: "3 Month funds",
        progress: 25.00,
        type: "Savings"
    },
    {
        name: "Goals Name",
        progress: 52.70,
        type: "Savings"
    }
]

function GoalsTab(props: { budgetId: string }) {
    return (
        <>
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

                            <div className="flex flex-row gap-2 items-center">
                                <Button variant="outline">
                                    <Trans i18nKey="common:transactionTabAddToGoalsBtn" />
                                </Button>

                                <Button variant="outline">
                                    <Trans i18nKey="common:addGoalsBtn" />
                                </Button>
                            </div>
                        </div>

                        <div className="w-full p-4">
                            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                {goals.map((goal, index) => (
                                    <Card key={index} className="p-4 h-[88px] bg-white shadow-sm flex justify-between items-start">
                                        <div className="space-y-0.5">
                                            <div className="text-xs text-gray-500">Goals</div>
                                            <h3 className="text-xs font-semibold text-gray-900">{goal.name}</h3>
                                            <div className="text-xs text-gray-500">{goal.type}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="inline-flex flex-col items-start bg-green-50 px-2 py-1 rounded">
                                                <div className="text-sm font-medium text-green-600">
                                                    {goal.progress.toFixed(2)}%
                                                </div>
                                                <div className="text-xs text-green-600">
                                                    On process
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </div>

                        <div className="overflow-auto">
                            <GaolsTable
                                budgetId={props.budgetId}
                            />
                        </div>
                    </div>
                </div>

                <div className="w-[300px] flex-shrink-0 p-4">
                    <GoalsOverview />
                </div>
            </div>
        </>
    );
}

export default GoalsTab;
