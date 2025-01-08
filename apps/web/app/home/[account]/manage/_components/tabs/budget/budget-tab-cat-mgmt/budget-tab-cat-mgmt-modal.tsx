'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@kit/ui/dialog';
import { CategoryManagementGroupSelect } from './budget-tab-cat-mgmt-group-select';
import { CategoryManagementCatSelect } from './budget-tab-cat-mgmt-cat-select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useBudgetWorkspace } from '~/components/budget-workspace-context';
import { CategoryCompositionData } from '~/lib/model/fin.types';

const formSchema = z.object({
  groupId: z.string().min(1, 'Group is required'),
  groupDescription: z.string().optional(),
  categoryId: z.string().optional(),
  categoryDescription: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CategoryManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoryManagementModal({
  open,
  onOpenChange,
}: CategoryManagementModalProps) {
  const { workspace, updateCategoryGroupDescription, updateCategory, addBudgetCategory } = useBudgetWorkspace();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCreatingCategoryId, setIsCreatingCategoryId] = useState('');
  const [compositeData, setCompositionData] = useState<{
    isCompositeMode: boolean;
    selectedCategories: CategoryCompositionData[];
  }>({ isCompositeMode: false, selectedCategories: [] });
  const [shouldReset, setShouldReset] = useState(false);

  const form = useForm<FormValues>({
    resetOptions: {
      keepValues: true, // Prevents values from being reset
    },
    resolver: zodResolver(formSchema),
    defaultValues: {
      groupId: '',
      groupDescription: '',
      categoryId: '',
      categoryDescription: '',
    },
  });

  // Modify the effect to only reset when shouldReset is true
  useEffect(() => {
    if (!open && shouldReset) {
      form.reset({
        groupId: '',
        groupDescription: '',
        categoryId: '',
        categoryDescription: '',
      });
      setShouldReset(false);
    }
  }, [open, form, shouldReset]);

  const { handleSubmit, watch, setValue, register } = form;
  const selectedGroupId = watch('groupId');
  const selectedCategoryId = watch('categoryId');

  // Add check for built-in group
  const selectedGroup = Object.values(workspace.budgetCategories).find(g => g.id === selectedGroupId);
  const isBuiltIn = !!selectedGroupId && selectedGroup?.budgetId == null;

  // Handle group selection changes
  useEffect(() => {
    if (selectedGroupId) {
      const group = Object.values(workspace.budgetCategories).find(g => g.id === selectedGroupId);
      setValue('groupDescription', group?.description ?? '');

      // Always reset category values when group changes
      setValue('categoryId', '');
      setValue('categoryDescription', '');
    }
  }, [selectedGroupId, setValue]);

  // Handle category selection changes
  useEffect(() => {
    if (selectedCategoryId && selectedGroupId) {
      const group = Object.values(workspace.budgetCategories).find(g => g.id === selectedGroupId);
      const category = group?.categories.find(c => c.id === selectedCategoryId);
      setValue('categoryDescription', category?.description ?? '');

      // Initialize composite mode if category is composite
      if (category?.isComposite && category.compositeData) {
        setCompositionData({
          isCompositeMode: true,
          selectedCategories: category.compositeData.map(comp => ({
            categoryName: comp.categoryName,
            weight: comp.weight,
            categoryId: comp.categoryId
          }))
        });
      } else {
        setCompositionData({
          isCompositeMode: false,
          selectedCategories: []
        });
      }
    }
  }, [selectedCategoryId, selectedGroupId, workspace.budgetCategories, setValue]);

  // Handle category creation
  useEffect(() => {
    if (isCreatingCategoryId) {
      console.log('isCreatingCategory... selected id:', isCreatingCategoryId);
      const group = Object.values(workspace.budgetCategories).find(g => g.id === selectedGroupId);
      const category = group?.categories.find(c => c.id === isCreatingCategoryId);
      setValue('categoryId', category?.id ?? '');
      setValue('categoryDescription', category?.description ?? '');
    }
  }, [workspace.budgetCategories]);

  const onSubmit = async (data: FormValues) => {
    if (isUpdating) return;
    setIsUpdating(true);

    try {
      if (compositeData.isCompositeMode) {
        // Validate composition data first
        if (compositeData.selectedCategories.length === 0) {
          throw new Error('Must select at least two categories for the composition');
        }

        const hasIncompleteRows = compositeData.selectedCategories.some(
          category => !category.categoryId || !category.categoryName || category.categoryId === ''
        );
        
        if (hasIncompleteRows) {
          throw new Error('All composition rows must be complete. Please remove empty rows or complete their information.');
        }

        const validCategories = compositeData.selectedCategories.filter(
          category => category.categoryId && category.categoryName && category.categoryId !== ''
        );

        if (validCategories.length < 2) {
          throw new Error('Composite categories must include at least two valid categories');
        }

        const hasZeroWeight = validCategories.some(category => category.weight === 0);
        if (hasZeroWeight) {
          throw new Error('All categories must have a weight greater than 0%');
        }

        const total = validCategories.reduce((sum, category) => sum + category.weight, 0);
        if (total !== 100) {
          throw new Error('The total distribution must equal 100%');
        }

        const payload = {
          groupId: data.groupId,
          ...(data.groupDescription !== undefined && { groupDescription: data.groupDescription }),
          ...(data.categoryId && { 
            categoryId: data.categoryId,
            categoryDescription: data.categoryDescription,
            isComposite: true,
            compositeData: validCategories
          })
        };

        const response = await fetch('/api/budget/transactions/update-category-group-desc', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update descriptions');
        }

        // Update local state
        if (data.groupId && data.groupDescription !== undefined) {
          updateCategoryGroupDescription(data.groupId, data.groupDescription);
        }
        
        if (data.categoryId) {
          updateCategory(
            data.groupId,
            data.categoryId,
            {
              description: data.categoryDescription,
              isComposite: compositeData.isCompositeMode,
              compositeData: compositeData.isCompositeMode 
                ? compositeData.selectedCategories 
                : null
            }
          );
        }
      } else {
        // Non-composite mode logic...
        const selectedCategory = selectedGroup?.categories.find(c => c.id === data.categoryId);
        const payload = {
          groupId: data.groupId,
          ...(data.groupDescription !== undefined && { groupDescription: data.groupDescription }),
          ...(data.categoryId && { 
            categoryId: data.categoryId,
            categoryDescription: data.categoryDescription,
            isComposite: false,
            compositeData: selectedCategory?.compositeData ?? null
          })
        };

        const response = await fetch('/api/budget/transactions/update-category-group-desc', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update descriptions');
        }

        // Update local state
        if (data.groupId && data.groupDescription !== undefined) {
          updateCategoryGroupDescription(data.groupId, data.groupDescription);
        }
        if (data.categoryId && data.categoryDescription !== undefined) {
          updateCategory(
            data.groupId,
            data.categoryId,
            {
              description: data.categoryDescription,
              isComposite: false,
              compositeData: selectedCategory?.compositeData ?? null
            }
          );
        }
      }

      // Show success toast only once after all updates are complete
      toast.success('Categories updated successfully');
    } catch (error: any) {
      console.error('Error updating categories:', error);
      toast.error(error.message || 'Error updating categories. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const sortedCategories = selectedGroup?.categories.slice().sort((a, b) => 
    a.name.localeCompare(b.name)
  ) ?? [];

  return (
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        // Only allow closing through explicit cancel actions
        if (!isOpen && !isUpdating) {
          setShouldReset(true);
          onOpenChange(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Categories</DialogTitle>
        </DialogHeader>

        <form 
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Group <span className="text-destructive">*</span></Label>
              <CategoryManagementGroupSelect
                value={selectedGroupId}
                onValueChange={(value) => setValue('groupId', value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Group Description</Label>
              <Textarea
                {...register('groupDescription')}
                disabled={!selectedGroupId || isBuiltIn}
                rows={4}
                maxLength={255}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <CategoryManagementCatSelect
                onValueChange={(value) => {
                  setValue('categoryId', value);
                  setValue('categoryDescription', '');
                }}
                onCreateCategory={async (category) => {
                  setIsCreatingCategoryId(category.id);
                  addBudgetCategory(selectedGroupId, category);
                }}
                value={selectedCategoryId}
                disabled={!selectedGroupId}
                categories={sortedCategories}
                budgetCategories={workspace.budgetCategories}
                isBuiltIn={isBuiltIn}
                budgetId={selectedGroup?.budgetId}
                groupId={selectedGroupId}
                onCompositionDataChange={setCompositionData}
              />
            </div>

            <div className="space-y-2">
              <Label>Category Description</Label>
              <Textarea
                {...register('categoryDescription')}
                disabled={!selectedCategoryId || isBuiltIn}
                rows={4}
                maxLength={255}
                className="resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isUpdating || !selectedGroupId || isBuiltIn}
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
        </form>
      </DialogContent>
    </Dialog>
  );
} 