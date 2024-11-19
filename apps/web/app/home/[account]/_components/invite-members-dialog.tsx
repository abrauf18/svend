'use client';

import {
  Dialog,
  DialogContent,
} from '@kit/ui/dialog';
import { useEffect, useState } from 'react';
import { useBudgetWorkspace } from '~/components/budget-workspace-context';

export function InviteMembersDialog({
  budgetId,
  children
}: {
  budgetId: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  const { workspace, updateBudgetOnboardingStep } = useBudgetWorkspace();

  useEffect(() => {
    setIsOpen(workspace.budget.onboardingStep === 'invite_members');
  }, [workspace.budget.onboardingStep]);
  
  const handleClose = async (isOpen: boolean) => {
    if (isOpen || isClosing) return;
    
    setIsClosing(true);
    try {
      const response = await fetch(`/api/budget/${budgetId}/onboarding/end`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to update budget onboarding step');
      }

      await response.json();
      
      // Update the context state
      updateBudgetOnboardingStep('end');
      
    } catch (error) {
      console.error('Failed to update budget onboarding step:', error);
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <Dialog open={isOpen && !isClosing} onOpenChange={handleClose} modal={true}>
      <DialogContent 
        className="w-[calc(100vw)] h-[calc(100vh)] p-4 md:h-auto md:max-h-[90vh] md:w-[800px] lg:min-w-[50vw] md:rounded-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
} 
