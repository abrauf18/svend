'use client';

import React, { useEffect, useState } from 'react';

import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card } from '@kit/ui/card';
import { Trans } from '@kit/ui/trans';

import { useBudgetWorkspace } from '~/components/budget-workspace-context';
import { BudgetGoal } from '~/lib/model/budget.types';
import { GoalCard } from './goals-tab-goal-card';

function GoalsTab() {
  const { workspace } = useBudgetWorkspace();
  const [goals, setGoals] = useState<BudgetGoal[]>([]);

  useEffect(() => {
    setGoals(workspace.budget.goals);
  }, [workspace.budget.goals]);

  return (
    <>
      <div className="flex w-full flex-row">
        <div className="flex-grow overflow-hidden">
          <div className="flex w-full flex-col gap-4">
            <div className="flex flex-row items-center justify-between">
              {/* <div className="flex flex-row items-center gap-2">
                <Button variant="outline">
                  <Trans i18nKey="common:transactionTabAddToGoalsBtn" />
                </Button>

                <Button variant="outline">
                  <Trans i18nKey="common:addGoalsBtn" />
                </Button>
              </div> */}
            </div>

            <div className="w-full p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {goals.map((goal, index) => (
                  <GoalCard key={index} goal={goal} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default GoalsTab;
