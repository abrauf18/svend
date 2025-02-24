import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@kit/ui/button';
import { Trans } from '@kit/ui/trans';
import { BudgetGoal } from '~/lib/model/budget.types';
import { SaveGoalForm } from './goals/save-goal-form';
import { DebtGoalForm } from './goals/debt-goal-form';
import { Check } from 'lucide-react';
import { InvestmentGoalForm } from './goals/investment-goal-form';
import { CharityGoalForm } from './goals/charity-goal-form';

type GoalType = 'savings' | 'debt' | 'investment' | 'charity';

interface GoalsCreationProps {
  selectedType: 'savings' | 'debt' | 'investment' | 'charity' | null;
  onValidationChange: (isValid: boolean, isDirty: boolean) => void;
  triggerSubmit: (submitHandler: () => Promise<boolean>) => void;
  onGoalCreated: (goal: BudgetGoal) => void;
  onTypeSelect: (type: 'savings' | 'debt' | 'investment' | 'charity' | null) => void;
  savedGoalTypes: Set<string>;
  onUnsavedChanges: (changes: { type: GoalType; subType: string | null }) => void;
  isSubmitting: boolean;
  triggerReset: (resetFunc: () => void) => void;
}

export function GoalsCreation({
  selectedType,
  onValidationChange,
  triggerSubmit,
  onGoalCreated,
  onTypeSelect,
  savedGoalTypes,
  onUnsavedChanges
}: GoalsCreationProps) {
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    console.log('GoalsCreation - selectedType changed:', { 
      selectedType, 
      isDirty 
    });
    if (selectedType) {
      setIsDirty(false);
      onValidationChange(false, false);
    }
  }, [selectedType]);

  const handleTypeSelect = useCallback((type: GoalType) => {
    console.log('GoalsCreation - handleTypeSelect:', { type, isDirty });
    if (isDirty) {
      const pendingChanges = { type, subType: null };
      console.log('GoalsCreation - triggering unsaved changes dialog');
      onUnsavedChanges(pendingChanges);
      return;
    }

    console.log('GoalsCreation - direct type change');
    onTypeSelect(type);
  }, [isDirty, onTypeSelect, onUnsavedChanges]);

  const handleGoalCreated = (goal: BudgetGoal) => {
    if (selectedType) {
      savedGoalTypes.add(selectedType);
    }
    setIsDirty(false);
    onValidationChange(false, false);
    onGoalCreated(goal);
  };

  const handleFormStateChange = (data: any) => {
    console.log('GoalsCreation - handleFormStateChange:', { data, selectedType });
    setIsDirty(true);
    onValidationChange(false, true);
  };

  const handleValidationChange = (isValid: boolean, isDirty: boolean) => {
    console.log('GoalsCreation - handleValidationChange:', { isValid, isDirty, selectedType });
    onValidationChange(isValid, isDirty);
  };

  const commonProps = {
    onValidationChange: handleValidationChange,
    triggerSubmit,
    onGoalCreated: handleGoalCreated,
    onFormStateChange: handleFormStateChange,
    onDirtyStateChange: (isDirty: boolean) => setIsDirty(isDirty)
  };

  return (
    <>
      <h3 className="text-xl font-semibold mb-6">
        <Trans i18nKey={'onboarding:financialGoalsTitle'} />
      </h3>
      <div className="flex flex-col space-y-8">
        <div>
          <h4 className="text-base font-medium mb-4">
            <Trans i18nKey={'onboarding:financialGoalsSubtitle'} />
          </h4>
          <div className="w-[500px] grid grid-cols-2 gap-4">
            {(['savings', 'debt', 'investment', 'charity'] as const).map((type) => (
              <Button
                key={type}
                variant={selectedType === type ? "default" : "outline"}
                onClick={() => handleTypeSelect(type)}
                className="flex flex-col items-center justify-center h-24 py-4 text-center relative"
              >
                {savedGoalTypes.has(type) && (
                  <div className="absolute top-2 right-2">
                    <Check className={`h-4 w-4 ${selectedType === type ? 'text-background' : 'text-primary'}`} />
                  </div>
                )}
                <div className="font-medium text-base">
                  {type === 'savings' && 'Save Money'}
                  {type === 'debt' && 'Pay Off Debt'}
                  {type === 'investment' && 'Invest'}
                  {type === 'charity' && 'Donate to Charity'}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {type === 'savings' && 'Build savings for your future'}
                  {type === 'debt' && 'Create a debt payoff plan'}
                  {type === 'investment' && 'Grow your wealth'}
                  {type === 'charity' && 'Plan your charitable giving'}
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* Goal Form */}
        {selectedType && (
          <div className="w-full">
            {selectedType === 'savings' && <SaveGoalForm {...commonProps} />}
            {selectedType === 'debt' && <DebtGoalForm {...commonProps} />}
            {selectedType === 'investment' && <InvestmentGoalForm {...commonProps} />}
            {selectedType === 'charity' && <CharityGoalForm {...commonProps} />}
          </div>
        )}
      </div>
    </>
  );
}
