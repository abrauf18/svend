import React, { useRef, useState, useEffect, useCallback } from 'react';

import { useOnboardingContext } from '@kit/accounts/components';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@kit/ui/card';
import { Progress } from '@kit/ui/progress';
import { Trans } from '@kit/ui/trans';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@kit/ui/alert-dialog';

import { PersonalInformation } from './part1-personal-information';
import { FinancialInformation } from './part2-financial-information';
import { GoalsCreation } from './part3-goals-creation';
import { Loader2, Save, AlertCircle } from 'lucide-react';
import { BudgetGoal } from '~/lib/model/budget.types';

interface PendingChange {
  type: 'savings' | 'debt' | 'investment' | 'charity' | null;
  subType: string | null;
}

function OnboardingStep2ProfileGoals() {
  const [currentSubStep, setCurrentSubStep] = useState(1);
  const [isFormValid, setIsFormValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitFormRef = useRef<() => Promise<boolean>>();
  const [selectedType, setSelectedType] = useState<'savings' | 'debt' | 'investment' | 'charity' | null>(null);
  const [selectedSubType, setSelectedSubType] = useState<string | null>(null);
  const [savedGoalTypes, setSavedGoalTypes] = useState<Set<string>>(new Set());
  const [isDirty, setIsDirty] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'next' | 'skip' | (() => void) | null>(null);
  const formResetRef = useRef<() => void>();

  // Store pending changes
  const [pendingTypeChange, setPendingTypeChange] = useState<PendingChange | null>(null);

  const { state, accountNextStep } = useOnboardingContext();

  // Only enable the next button on step 3 if at least one goal has been saved
  const isNextButtonEnabled = currentSubStep !== 3 ? isFormValid : (
    savedGoalTypes.size > 0
  );

  async function updateContextKey(contextKey: string) {
    try {
      const response = await fetch('/api/onboarding/account/state', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contextKey,
          validContextKeys: ['profile_goals', 'analyze_spending', 'analyze_spending_in_progress', 'budget_setup', 'end']
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Error updating context:', error);
        return;
      }

      accountNextStep();
    } catch (error) {
      console.error('Error updating context:', error);
    }
  }

  const handleGoalCreated = (goal: BudgetGoal) => {
    if (selectedType) {
      setSavedGoalTypes(prev => new Set([...prev, selectedType]));
    }
  };

  const handleSaveGoal = async () => {
    if (!submitFormRef.current) return;
    
    setIsSubmitting(true);
    try {
      const success = await submitFormRef.current();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async () => {
    if (isDirty) {
      setPendingAction('next');
      setShowConfirmDialog(true);
      return;
    }

    // Original submit logic
    if (currentSubStep !== 3) {
      if (!submitFormRef.current) return;
      setIsSubmitting(true);
      try {
        const success = await submitFormRef.current();
        if (success) {
          setCurrentSubStep(prev => Math.min(prev + 1, 3));
        }
      } finally {
        setIsSubmitting(false);
      }
    } else {
      if (savedGoalTypes.size > 0) {
        await updateContextKey('analyze_spending');
      }
    }
  };

  const handleSkip = () => {
    if (isDirty) {
      setPendingAction('skip');
      setShowConfirmDialog(true);
      return;
    }
    updateContextKey('analyze_spending');
  };

  const handleTypeSelect = useCallback((type: 'savings' | 'debt' | 'investment' | 'charity' | null) => {
    console.log('OnboardingStep2 - handleTypeSelect:', { type });
    setSelectedType(type);
  }, []);

  const handleConfirmAction = useCallback(() => {
    console.log('OnboardingStep2 - handleConfirmAction');
    setShowConfirmDialog(false);
    
    if (pendingTypeChange) {
      // Reset form state before changing type
      if (formResetRef.current) {
        formResetRef.current();
      }
      
      handleTypeSelect(pendingTypeChange.type);
      setIsDirty(false);
      setIsFormValid(true);
      setPendingTypeChange(null);
    }
    
    if (pendingAction === 'skip') {
      // Reset form state and proceed with skip
      if (formResetRef.current) {
        formResetRef.current();
      }
      setIsDirty(false);
      setIsFormValid(true);
      updateContextKey('analyze_spending');
    } else if (typeof pendingAction === 'function') {
      pendingAction();
    }
    setPendingAction(null);
  }, [pendingTypeChange, pendingAction, handleTypeSelect, updateContextKey]);

  const handleCancelAction = () => {
    setShowConfirmDialog(false);
    setPendingAction(null);
  };

  // Update the handler to accept dirty state
  const handleValidationChange = (isValid: boolean, isDirty: boolean) => {
    setIsFormValid(isValid);
    setIsDirty(isDirty);
  };

  // Renders the appropriate step component
  const renderStep = () => {
    switch (currentSubStep) {
      case 1:
        return (
          <PersonalInformation
            initialData={state.account.profileData}
            onValidationChange={(isValid) => handleValidationChange(isValid, false)}
            triggerSubmit={(submitFunc) => (submitFormRef.current = submitFunc)}
          />
        );
      case 2:
        return (
          <FinancialInformation
            initialData={state.account.profileData}
            onValidationChange={(isValid) => handleValidationChange(isValid, false)}
            triggerSubmit={(submitFunc) => (submitFormRef.current = submitFunc)}
          />
        );
      case 3:
        return (
          <GoalsCreation
            selectedType={selectedType}
            onValidationChange={handleValidationChange}
            triggerSubmit={(submitFunc) => (submitFormRef.current = submitFunc)}
            onGoalCreated={handleGoalCreated}
            onTypeSelect={handleTypeSelect}
            savedGoalTypes={savedGoalTypes}
            isSubmitting={isSubmitting}
            onUnsavedChanges={(changes: PendingChange) => {
              console.log('OnboardingStep2 - onUnsavedChanges called', changes);
              setPendingTypeChange(changes);
              setShowConfirmDialog(true);
            }}
            triggerReset={(resetFunc) => (formResetRef.current = resetFunc)}
          />
        );
      default:
        return null;
    }
  };

  // Add this effect to initialize savedGoalTypes from existing goals
  useEffect(() => {
    if (state.account.budget?.goals) {
      setSavedGoalTypes(new Set(
        state.account.budget.goals.map(goal => goal.type)
      ));
    }
  }, [state.account.budget?.goals]);

  // Add this effect to initialize selected types from existing goals
  useEffect(() => {
    if (state.account.budget?.goals?.length) {
      // Get the most recent goal
      const latestGoal = state.account.budget.goals[state.account.budget.goals.length - 1];
      if (latestGoal) {
        setSelectedType(latestGoal.type as 'savings' | 'debt' | 'investment' | 'charity');
        setSelectedSubType(latestGoal.subType || null);
      }
    }
  }, [state.account.budget?.goals]);

  // Add navigation guard
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const saveButtonContent = (
    <div className="flex items-center gap-4">
      <Button
        onClick={handleSaveGoal}
        disabled={
          !isFormValid || 
          isSubmitting
        }
      >
        {isDirty && <AlertCircle className="h-4 w-4 mr-2" />}
        Save Goal
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin ml-2" />
        ) : null}
      </Button>
      {isDirty && (
        <div className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm">
          Unsaved Changes
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl h-[calc(100vh-6rem)]">
      <Card className="w-full h-full flex flex-col">
        <CardHeader className="space-y-4 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <svg
              className="h-8 w-8 text-primary"
              fill="none"
              height="24"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M16.5 9.4 7.55 4.24" />
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.29 7 12 12 20.71 7" />
              <line x1="12" x2="12" y1="22" y2="12" />
            </svg>
            <span className="text-xl font-semibold">Svend</span>
          </div>
          <h2 className="text-2xl font-bold">
            <Trans i18nKey={'onboarding:finBackgroundTitle'} />
          </h2>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Step 2 of 3</p>
            <Progress
              value={33 + (currentSubStep / 3) * 33}
              className="w-full md:w-1/2 lg:w-full"
            />
          </div>
          <div className="flex items-center space-x-4">
            <p className="w-full md:w-auto text-xs font-medium pl-4">Part {currentSubStep} of 3</p>
            <div className="flex space-x-1">
              {[1, 2, 3].map((step) => (
                <span
                  key={step}
                  className={`h-2 w-2 ${currentSubStep >= step ? 'bg-primary' : 'bg-muted'} rounded-full`}
                ></span>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 flex-1 overflow-y-auto card-content">
          {currentSubStep === 1 && (
            <p className="max-w-xl text-sm text-muted-foreground">
              <Trans i18nKey={'onboarding:finBackgroundInstructionText'} />
            </p>
          )}
          
          {/* Upper button/indicator */}
          {currentSubStep === 3 && selectedType && isDirty && (
            <div className="flex items-center gap-4 mb-6">
              {saveButtonContent}
            </div>
          )}

          {renderStep()}
          
          {/* Lower button/indicator */}
          {currentSubStep === 3 && selectedType && (
            <div className="flex items-center gap-4 mt-6 pt-4 border-t">
              {saveButtonContent}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex-shrink-0 border-t pt-4">
          <div className="flex space-x-4">
            <Button
              variant="outline"
              onClick={handleFormSubmit}
              disabled={!isNextButtonEnabled || (currentSubStep !== 3 && isSubmitting)}
            >
              {currentSubStep !== 3 && isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                <Trans i18nKey="onboarding:nextButtonLabel" />
              )}
            </Button>
            {currentSubStep === 3 && (
              <Button
                variant="ghost"
                onClick={handleSkip}
              >
                <Trans i18nKey="skip" />
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to proceed? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelAction}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction} className="bg-orange-500 hover:bg-orange-600">Continue and discard changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default OnboardingStep2ProfileGoals;
