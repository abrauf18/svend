'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import DatePicker from 'react-datepicker';
import { Button } from '@kit/ui/button';
import { z } from 'zod';
import { useBudgetWorkspace } from '~/components/budget-workspace-context';
import { BudgetFormSchema, BudgetManageTable } from './budget-tab-table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@kit/ui/alert-dialog";
import { CategoryManagementModal } from './budget-tab-cat-mgmt/budget-tab-cat-mgmt-modal';
import { toast } from 'sonner';

interface BudgetTabProps {
  onDirtyStateChange?: (isDirty: boolean) => void;
}

function BudgetTab({ onDirtyStateChange }: BudgetTabProps) {
  const { workspace, updateBudgetSpending } = useBudgetWorkspace();
  const formRef = useRef<HTMLFormElement>(null);
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
  const [pendingDate, setPendingDate] = useState<Date | null>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Find earliest transaction date
  const earliestDate = React.useMemo(() => {
    if (!workspace?.budgetTransactions?.length) return null;
    
    return workspace.budgetTransactions.reduce((earliest, current) => {
      const [year, month] = current.transaction.date.split('-').map(Number);
      const currentDate = new Date(year!, month! - 1); // month is 0-based in JS Date
      
      if (!earliest) return currentDate;
      return currentDate < earliest ? currentDate : earliest;
    }, null as Date | null);
  }, [workspace?.budgetTransactions]);

  // Check if current selected date is the earliest month
  const isEarliestMonth = React.useMemo(() => {
    if (!earliestDate) return false;
    
    return selectedDate.getFullYear() === earliestDate.getFullYear() &&
           selectedDate.getMonth() === earliestDate.getMonth();
  }, [selectedDate, earliestDate]);

  const handleDateChange = (date: Date) => {
    if (isFormDirty) {
      setPendingDate(date);
      setShowUnsavedChangesDialog(true);
    } else {
      setSelectedDate(date);
    }
  };

  const handleBudgetSubmit = async (budgetData: z.infer<typeof BudgetFormSchema>) => {
    setIsSaving(true);
    const formReqData = {
      date: `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`,
      categorySpending: budgetData.categoryGroups.reduce<Record<string, any>>(
        (acc, group) => {
          acc[group.groupName!] = {
            groupName: group.groupName,
            target: Number(group.target),
            isTaxDeductible: group.isTaxDeductible,
            targetSource: group.targetSource,
            categories: group.categories.map((cat) => ({
              categoryName: cat.categoryName,
              target: Number(cat.target),
              isTaxDeductible: cat.isTaxDeductible,
            })),
          };
          return acc;
        },
        {},
      ),
    };

    try {
      const response = await fetch(`/api/budgets/${workspace.budget.id}/spending-tracking`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formReqData),
      });

      if (!response.ok) {
        throw new Error('Failed to save budget');
      }

      const data = await response.json();
      
      // Create a deep copy of the current spending tracking
      const updatedSpendingTracking = {
        ...workspace.budget.spendingTracking
      };

      // Update the specific month's data with a proper deep merge
      const monthKey = formReqData.date;
      updatedSpendingTracking[monthKey] = Object.keys(data.spendingTracking[monthKey]).reduce(
        (acc, groupName) => {
          acc[groupName] = {
            ...updatedSpendingTracking[monthKey]?.[groupName],
            ...data.spendingTracking[monthKey][groupName],
            categories: data.spendingTracking[monthKey][groupName].categories?.map(
              (newCat: any) => ({
                ...updatedSpendingTracking[monthKey]?.[groupName]?.categories?.find(
                  (c: any) => c.categoryName === newCat.categoryName
                ),
                ...newCat,
              })
            ),
          };
          return acc;
        },
        {} as Record<string, any>
      );

      // Update the context with the properly merged data
      updateBudgetSpending(updatedSpendingTracking);
      
      setIsFormDirty(false);
      toast.success("Budget saved successfully", {
        duration: 3000,
        position: 'bottom-center',
      });
    } catch (error) {
      console.error('Error saving budget:', error);
      toast.error("Failed to save budget. Please try again.", {
        duration: 3000,
        position: 'bottom-center',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmNavigation = () => {
    if (pendingDate) {
      setSelectedDate(pendingDate);
      setIsFormDirty(false);
    }
    setShowUnsavedChangesDialog(false);
    setPendingDate(null);
  };

  // Handle beforeunload event
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isFormDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isFormDirty]);

  // Update isFormDirty state to notify parent
  useEffect(() => {
    onDirtyStateChange?.(isFormDirty);
  }, [isFormDirty, onDirtyStateChange]);

  const maxDate = new Date();

  return (
    <>
      <div className="flex w-full flex-col lg:flex-row">
        <div className="flex-grow overflow-hidden">
          <div className="flex w-full flex-col gap-4">
            {/* Date navigation and buttons */}
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center sm:gap-0">
              <div className="flex flex-row items-center gap-2">
                <button
                  className={`rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    isEarliestMonth ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  onClick={() => handleDateChange(
                    new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1)
                  )}
                  disabled={isEarliestMonth}
                >
                  <ChevronLeft size={16} />
                </button>

                <DatePicker
                  selected={selectedDate}
                  onChange={(date) => handleDateChange(date || new Date())}
                  dateFormat="MMMM yyyy"
                  showMonthYearPicker
                  className="w-[150px] bg-transparent text-center text-sm font-medium"
                  maxDate={maxDate}
                  minDate={earliestDate ?? undefined}
                  renderCustomHeader={({
                    date,
                    decreaseMonth,
                    increaseMonth,
                  }: {
                    date: Date;
                    decreaseMonth: () => void;
                    increaseMonth: () => void;
                  }) => (
                    <div className="flex items-center justify-between">
                      <button
                        onClick={decreaseMonth}
                        disabled={!earliestDate || date.getFullYear() === earliestDate.getFullYear() && date.getMonth() === earliestDate.getMonth()}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span>{`${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`}</span>
                      <button
                        onClick={increaseMonth}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                        disabled={date.getMonth() === new Date().getMonth() && date.getFullYear() === new Date().getFullYear()}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                />

                <button
                  className={`rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    selectedDate.getMonth() === new Date().getMonth() && 
                    selectedDate.getFullYear() === new Date().getFullYear() 
                      ? 'opacity-50 cursor-not-allowed' 
                      : ''
                  }`}
                  onClick={() => handleDateChange(
                    new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1)
                  )}
                  disabled={
                    selectedDate.getMonth() === new Date().getMonth() && 
                    selectedDate.getFullYear() === new Date().getFullYear()
                  }
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="flex-grow flex justify-center">
                {isFormDirty && (
                  <Button 
                    onClick={() => formRef.current?.requestSubmit()}
                    className="gap-2 border-orange-500 text-orange-500 hover:bg-orange-100 dark:hover:bg-orange-950"
                    variant="outline"
                    disabled={isSaving}
                  >
                    <Save className="h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                )}
              </div>

              <div className="sm:w-[200px] flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsCategoryDialogOpen(true)}
                >
                  Manage Categories
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="overflow-auto">
                <BudgetManageTable
                  onSubmit={handleBudgetSubmit}
                  ref={formRef}
                  selectedDate={selectedDate}
                  onDirtyStateChange={setIsFormDirty}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <CategoryManagementModal
        open={isCategoryDialogOpen}
        onOpenChange={setIsCategoryDialogOpen}
      />

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
              setPendingDate(null);
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

export default BudgetTab;
