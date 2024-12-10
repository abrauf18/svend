'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@kit/ui/dialog';
import { CategoryManagementGroupSelect } from './category-manage-group-select';
import { CategoryManagementCatSelect } from './category-manage-cat-select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useBudgetWorkspace } from '~/components/budget-workspace-context';

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
  const { workspace, updateCategoryGroupDescription, updateCategoryDescription, addBudgetCategory } = useBudgetWorkspace();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCreatingCategoryId, setIsCreatingCategoryId] = useState('');

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

  // Add this effect to reset form when modal is closed
  useEffect(() => {
    if (!open) {
      form.reset({
        groupId: '',
        groupDescription: '',
        categoryId: '',
        categoryDescription: '',
      });
    }
  }, [open, form]);

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
      setValue('groupDescription', group?.description || '');
      
      // Always reset category values when group changes
      setValue('categoryId', '');
      setValue('categoryDescription', '');
    }
  }, [selectedGroupId, workspace.budgetCategories, setValue]);

  // Handle category selection changes
  useEffect(() => {
    if (selectedCategoryId && selectedGroupId) {
      const group = Object.values(workspace.budgetCategories).find(g => g.id === selectedGroupId);
      const category = group?.categories.find(c => c.id === selectedCategoryId);
      setValue('categoryDescription', category?.description || '');
    }
  }, [selectedCategoryId, selectedGroupId, workspace.budgetCategories, setValue]);

  // Handle category creation
  useEffect(() => {
    if (isCreatingCategoryId) {
      console.log('isCreatingCategory... selected id:', isCreatingCategoryId);
      const group = Object.values(workspace.budgetCategories).find(g => g.id === selectedGroupId);
      const category = group?.categories.find(c => c.id === isCreatingCategoryId);
      setValue('categoryId', category?.id || '');
      setValue('categoryDescription', category?.description || '');
    }
  }, [workspace.budgetCategories]);

  const onSubmit = async (data: FormValues) => {
    setIsUpdating(true);

    console.log('onSubmit data:', data);
    form.reset(data);

    try {
      const payload = {
        groupId: data.groupId,
        ...(data.groupDescription !== undefined && { groupDescription: data.groupDescription }),
        ...(data.categoryId && { 
          categoryId: data.categoryId,
          categoryDescription: data.categoryDescription 
        })
      };

      const response = await fetch('/api/budget/transactions/update-category-group-desc', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 400) {
          toast.error(
            errorData.message || 
            'Invalid input. Descriptions must be 255 characters or less.'
          );
        } else {
          throw new Error('Failed to update descriptions');
        }
        return;
      }

      // Update local state through context
      if (data.groupId && data.groupDescription !== undefined) {
        updateCategoryGroupDescription(data.groupId, data.groupDescription);
      }
      if (data.categoryId && data.categoryDescription !== undefined) {
        updateCategoryDescription(data.groupId, data.categoryId, data.categoryDescription);
      }

      toast.success('Categories updated successfully');
    } catch (error) {
      console.error('Error updating categories:', error);
      toast.error('Failed to update categories. Please try again later.');
    } finally {
      setIsUpdating(false);
    }
  };

  const sortedCategories = selectedGroup?.categories.slice().sort((a, b) => 
    a.name.localeCompare(b.name)
  ) || [];

  return (
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        // Only allow closing through explicit cancel actions
        if (!isOpen && !isUpdating) {
          onOpenChange(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
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
                isBuiltIn={isBuiltIn}
                budgetId={selectedGroup?.budgetId}
                groupId={selectedGroupId}
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
              type="button"
              onClick={() => void onSubmit(form.getValues())}
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