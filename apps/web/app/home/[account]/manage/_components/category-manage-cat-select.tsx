'use client';

import React, { useState, useRef, useEffect, FocusEvent, useMemo } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { CaretSortIcon, LockClosedIcon } from '@radix-ui/react-icons';
import { cn } from '@kit/ui/utils';
import { Input } from '@kit/ui/input';
import { useBudgetWorkspace } from '~/components/budget-workspace-context';
import { Category } from '~/lib/model/fin.types';
import { toast } from 'sonner';

interface CategoryManagementCatSelectProps {
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  groupId?: string;
}

const filterAndSortCategories = (categories: Category[], query: string) => {
  if (!query) return categories;

  return categories
    .filter(category =>
      category.name.toLowerCase().startsWith(query.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));
};

const highlightMatch = (text: string, query: string) => {
  if (!query) return text;

  if (text.toLowerCase().startsWith(query.toLowerCase())) {
    return (
      <>
        <span className="font-bold">{text.slice(0, query.length)}</span>
        {text.slice(query.length)}
      </>
    );
  }

  return text;
};

const MAX_NAME_LENGTH = 50;
const truncateText = 'truncate max-w-[300px]';

export function CategoryManagementCatSelect({
  onValueChange,
  disabled,
  placeholder = "Select category",
  groupId
}: CategoryManagementCatSelectProps) {
  const { workspace, addBudgetCategory } = useBudgetWorkspace();
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<typeof workspace.budgetCategories[string] | null>(null);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Watch for workspace changes and group changes
  useEffect(() => {
    const group = groupId
      ? Object.values(workspace.budgetCategories).find(g => g.id === groupId)
      : null;
    setSelectedGroup(group ?? null);
  }, [groupId, workspace.budgetCategories]);

  // Update filtered categories when search or categories change
  useEffect(() => {
    const filtered = filterAndSortCategories(selectedGroup?.categories || [], searchQuery);
    setFilteredCategories(filtered);
  }, [selectedGroup?.categories, searchQuery]);

  const isBuiltIn = selectedGroup?.budgetId == null;

  const handleValueChange = (newValue: string) => {
    if (newValue) {
      setSelectedValue(newValue);
      onValueChange(newValue);
      setSearchQuery('');
    }
  };
  
  const validateName = (name: string) => {
    if (!name.trim()) {
      return { isValid: false, error: 'Name cannot be empty' };
    }
    if (name.length > MAX_NAME_LENGTH) {
      return { isValid: false, error: `Name cannot exceed ${MAX_NAME_LENGTH} characters` };
    }
    if (!/^[a-zA-Z]/.test(name)) {
      return { isValid: false, error: 'Name must start with a letter' };
    }
    if (!/^[a-zA-Z0-9\s.,'-]+$/.test(name)) {
      return { isValid: false, error: 'Name can only contain letters, numbers, spaces, and basic punctuation' };
    }
    
    // Check for uniqueness across all groups
    const normalizedName = name.toLowerCase().trim();
    const isNameTaken = Object.values(workspace.budgetCategories).some(group => 
      group.categories.some(category => 
        category.name.toLowerCase().trim() === normalizedName
      )
    );
    if (isNameTaken) {
      return { isValid: false, error: 'A category with this name already exists in your budget' };
    }
  
    return { isValid: true, error: null };
  };

  const createNewCategory = async (
    groupId: string,
    categoryName: string,
    description: string,
  ) => {
    try {
      const response = await fetch('/api/budget/transactions/create-category', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          categoryName,
          description,
          budgetId: workspace.budget.id
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create category');
      }

      const data = await response.json();
      if (!data.category) {
        throw new Error('No category returned from server');
      }

      return data.category;
    } catch (error) {
      console.error('Error creating new category:', error);
      throw error;
    }
  };

  const handleCreateNew = async () => {
    if (!selectedGroup) return;

    try {
      const validation = validateName(searchQuery);
      if (!validation.isValid) {
        toast.error(`Unable to create category. ${validation.error}. The category name must: (1) Be between 1-50 characters (2) Start with a letter (3) Contain only letters, numbers, spaces, and basic punctuation (4) Be unique across all groups in your budget. Please try again with a valid name.`, {
          className: "bg-destructive text-destructive-foreground",
          descriptionClassName: "text-destructive-foreground",
          duration: 6000
        });
        return;
      }

      const formattedName = searchQuery.charAt(0).toUpperCase() + searchQuery.slice(1);

      setIsCreatingCategory(true);
      const response = await createNewCategory(selectedGroup.id, formattedName, '');
      
      if (!response?.id) {
        throw new Error('Invalid category returned from server');
      }

      addBudgetCategory(selectedGroup.id, response);
      setSearchQuery('');
      setSelectedValue(response.id);
      onValueChange(response.id);
      setIsOpen(false);

      toast.success('Category created successfully');
    } catch (error: any) {
      console.error('Error creating new category:', error);
      const errorMessage = error?.message || '';
      
      if (errorMessage.toLowerCase().includes('duplicate')) {
        toast.error('A category with this name already exists in this group. Please choose a different name.', {
          className: "bg-destructive text-destructive-foreground",
          descriptionClassName: "text-destructive-foreground"
        });
      } else {
        toast.error('Unable to create category. The category name must: (1) Be between 1-50 characters (2) Start with a letter (3) Contain only letters, numbers, spaces, and basic punctuation (4) Be unique across all groups in your budget. Please try again with a valid name.', {
          className: "bg-destructive text-destructive-foreground",
          descriptionClassName: "text-destructive-foreground",
          duration: 6000 // Increased duration for longer message
        });
      }
    } finally {
      setIsCreatingCategory(false);
    }
  };

  return (
    <SelectPrimitive.Root
      value={selectedValue || undefined}
      onValueChange={handleValueChange}
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <SelectPrimitive.Trigger
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        )}
        disabled={disabled}
      >
        <SelectPrimitive.Value placeholder={placeholder}>
          {selectedValue && selectedGroup && (
            <div className="flex items-center">
              {isBuiltIn && <LockClosedIcon className="mr-2 h-3 w-3 opacity-70" />}
              <span className={truncateText}>
                {selectedGroup.categories.find(c => c.id === selectedValue)?.name}
              </span>
            </div>
          )}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon>
          <CaretSortIcon className="h-4 w-4 opacity-50" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="relative z-50 min-w-[8rem] max-h-[25vh] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
          position="popper"
          sideOffset={5}
          onFocusCapture={(e: React.FocusEvent) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <div
            className="w-full border-b p-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Input
              ref={inputRef}
              value={searchQuery}
              maxLength={MAX_NAME_LENGTH}
              onChange={(e) => {
                setSearchQuery(e.target.value);
              }}
              placeholder="Search for categories"
              className={truncateText}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>

          <SelectPrimitive.Viewport
            ref={viewportRef}
            className="max-h-[300px] overflow-y-auto p-1"
          >
            {!isBuiltIn && searchQuery &&
              !selectedGroup?.categories.some(category =>
                category.name.toLowerCase() === searchQuery.toLowerCase()
              ) && (
                <div
                  onClick={() => void handleCreateNew()}
                  className={cn(
                    'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
                    isCreatingCategory
                      ? 'cursor-not-allowed opacity-50'
                      : 'hover:bg-accent hover:text-accent-foreground',
                  )}
                  style={{
                    pointerEvents: isCreatingCategory ? 'none' : 'auto',
                  }}
                >
                  <span className="flex-1">
                    Create new category &quot;{searchQuery}&quot;
                  </span>
                  {isCreatingCategory && (
                    <div className="flex h-4 w-4 items-center justify-center">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  )}
                </div>
              )}

            {selectedGroup && (
              <div className="mb-2">
                <div className="px-2 text-sm text-muted-foreground">
                  {selectedGroup.name}
                </div>
                <div className="space-y-1 p-2">
                  {filteredCategories.map((category) => (
                    <SelectPrimitive.Item
                      key={`${category.id}-${category.name}`}
                      value={category.id}
                      className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    >
                      {isBuiltIn && (
                        <LockClosedIcon className="mr-2 h-3 w-3 opacity-70" />
                      )}
                      <SelectPrimitive.ItemText>
                        <span className={truncateText}>
                          {highlightMatch(category.name, searchQuery)}
                        </span>
                      </SelectPrimitive.ItemText>
                    </SelectPrimitive.Item>
                  ))}
                </div>
              </div>
            )}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
} 
