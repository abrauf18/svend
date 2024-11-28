'use client';

import React, { useEffect, useRef, useState } from 'react';

import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import DatePicker from 'react-datepicker';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';

import { z } from 'zod';

import { useBudgetWorkspace } from '~/components/budget-workspace-context';
import { CategoryGroup } from '~/lib/model/fin.types';

import { BudgetCategorySelect } from './budget-category-select';
import { BudgetGroupSelect } from './budget-group-select';
import { BudgetFormSchema, BudgetManageTable } from './budget-manage-table';
import { toast } from 'sonner';

const MAX_DESCRIPTION_LENGTH = 255;

function BudgetTab() {
  const {
    workspace,
    updateCategoryGroupDescription,
    updateCategoryDescription,
  } = useBudgetWorkspace();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedGroup, setSelectedGroup] = useState<CategoryGroup | null>(
    null,
  );

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  const maxDate = new Date();
  const [defaultCategoryGroups, setDefaultCategoryGroups] = useState<
    CategoryGroup[]
  >([]);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);

  const handleCreateCategoryClick = () => {
    setIsCategoryDialogOpen(true);
  };

  useEffect(() => {
    const logDefaultCategoryGroups = () => {
      const defaultCategoryGroups = workspace.budgetCategories;
      console.log(
        'Default category groups:',
        Object.values(defaultCategoryGroups),
      );
      setDefaultCategoryGroups(Object.values(defaultCategoryGroups));
    };
    logDefaultCategoryGroups();
  }, [workspace.budgetCategories]);

  const [isGroupDisabled, setIsGroupDisabled] = useState(true);
  const [isCategoryDisabled, setIsCategoryDisabled] = useState(true);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupDescription, setNewGroupDescription] = useState('');

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);
  const [newCategoryId, setNewCategoryId] = useState<string | null>(null);

  //update categoty list when workspace changes
  useEffect(() => {
    setDefaultCategoryGroups(Object.values(workspace.budgetCategories));
  }, [workspace]);

  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateCategory = async () => {
    setIsUpdating(true);

    try {
      const requestBody: {
        groupId?: string;
        groupDescription?: string;
        categoryId?: string;
        categoryDescription?: string;
      } = {};

      // Always include group update if a group is selected
      if (selectedGroupId) {
        requestBody.groupId = selectedGroupId;
        requestBody.groupDescription = newGroupDescription || '';
      }

      // Include category update only if a category is selected
      if (newCategoryId) {
        requestBody.categoryId = newCategoryId;
        requestBody.categoryDescription = newCategoryDescription || '';
      }

      const response = await fetch(
        '/api/budget/transactions/update-category-group-desc',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update descriptions');
      }

      // If successful, update local state
      if (selectedGroupId && newGroupDescription) {
        updateCategoryGroupDescription(selectedGroupId, newGroupDescription);
      }
      if (newCategoryId && newCategoryDescription) {
        updateCategoryDescription(
          selectedGroupId ?? '',
          newCategoryId,
          newCategoryDescription
        );
      }

      // Show success toast
      toast.success('Categories updated successfully');
    } catch (error) {
      console.error('Error updating categories:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update categories');
    } finally {
      setIsUpdating(false);
    }
  };

  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleBudgetSubmit = async (budgetData: z.infer<typeof BudgetFormSchema>) => {
    const formReqData = {
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
      const response = await fetch('/api/budget/spending', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formReqData),
      });

      if (!response.ok) {
        throw new Error('Failed to save budget');
      }

      // Handle successful update
      const data = await response.json();
      // Update local state or show success message
    } catch (error) {
      console.error('Error saving budget:', error);
    }
  };

  return (
    <>
      <div className="flex w-full flex-col lg:flex-row">
        <div className="flex-grow overflow-hidden">
          <div className="flex w-full flex-col gap-4">
            {/* Date navigation and create button */}
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center sm:gap-0">
              <div className="flex flex-row items-center gap-2">
                {/* Date controls */}
                <button
                  className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() =>
                    handleDateChange(
                      new Date(
                        selectedDate.getFullYear(),
                        selectedDate.getMonth() - 1,
                      ),
                    )
                  }
                  disabled={selectedDate.getMonth() === 0}
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
                />

                <button
                  className={`rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700 ${selectedDate.getMonth() === new Date().getMonth() &&
                    selectedDate.getFullYear() === new Date().getFullYear()
                    ? 'cursor-not-allowed opacity-50'
                    : ''
                    }`}
                  onClick={() =>
                    handleDateChange(
                      new Date(
                        selectedDate.getFullYear(),
                        selectedDate.getMonth() + 1,
                      ),
                    )
                  }
                  disabled={
                    selectedDate.getMonth() === new Date().getMonth() &&
                    selectedDate.getFullYear() === new Date().getFullYear()
                  }
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handleCreateCategoryClick}
              >
                Manage Categories
              </Button>
            </div>

            <div className="space-y-4">
              {/* Transaction table */}
              <div className="overflow-auto">
                <BudgetManageTable
                  onSubmit={handleBudgetSubmit}
                  ref={formRef}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Category creation dialog */}
        <Dialog
          open={isCategoryDialogOpen}
          onOpenChange={setIsCategoryDialogOpen}
        >
          <DialogContent className="h-[calc(100vh)] w-[calc(100vw)] p-4 md:h-auto md:max-h-[90vh] md:w-[800px] md:rounded-lg lg:min-w-[20vw]">
            <DialogHeader>
              <DialogTitle>Manage Categories</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4 my-4">
              <div className="space-y-2">
                <Label className="font-bold">Group <span className="text-red-500">*</span></Label>
                {/* Add BudgetCategorySelect here */}
                <BudgetGroupSelect
                  value={selectedGroupId}
                  onValueChange={(groupId) => {
                    if (groupId === selectedGroupId) return;

                    const group = defaultCategoryGroups.find((g) => g.id === groupId) ?? null;
                    setSelectedGroup(group);
                    setSelectedGroupId(groupId);
                    setSelectedGroupName(group?.name ?? null);
                    setNewGroupDescription(group?.description ?? '');
                    setNewCategoryId(null);
                    setNewCategoryName('');
                    setNewCategoryDescription('');
                    setIsGroupDisabled(group?.budgetId == null);
                    setIsCategoryDisabled(true);
                  }}
                  placeholder="Select a group"
                  categoryGroups={defaultCategoryGroups}
                  disabled={isAddingGroup}
                />
              </div>

              {/* Group Description input */}
              <div className="space-y-2">
                <Label className="font-light">Description</Label>
                <Textarea
                  value={newGroupDescription}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  placeholder="Enter group description"
                  disabled={!selectedGroupId || isGroupDisabled}
                  rows={4}
                  className="resize-none"
                />
              </div>
            </div>

            {/* Category name dropdown */}
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label className="font-bold">Category <span className="text-red-500">*</span></Label>
                <BudgetCategorySelect
                  key={selectedGroupId}
                  value={newCategoryId ?? undefined}
                  onValueChange={(categoryId) => {
                    if (categoryId === newCategoryId) return;

                    console.log('Selected category ID:', categoryId);
                    const category = selectedGroup?.categories.find(c => c.id === categoryId);

                    setNewCategoryId(categoryId);
                    setIsAddingCategory(false);
                    setIsCategoryDisabled(false);
                    setNewCategoryDescription(category?.description ?? '');
                  }}
                  categoryGroups={defaultCategoryGroups}
                  placeholder="Select a category"
                  disabled={!selectedGroupName || isAddingCategory}
                  selectedGroupId={selectedGroupId}
                />
              </div>
              {/* Category Description input */}
              <div className="space-y-2">
                <Label className="font-light">Description</Label>
                <Textarea
                  value={newCategoryDescription}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  placeholder="Enter category description"
                  disabled={isCategoryDisabled || selectedGroup?.budgetId == null}
                  rows={4}
                  className="resize-none"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setIsCategoryDialogOpen(false)}
                variant="outline"
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateCategory}
                disabled={
                  isUpdating || 
                  !selectedGroupId || 
                  (isGroupDisabled && isCategoryDisabled) || 
                  selectedGroup?.budgetId == null
                }
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}

export default BudgetTab;
