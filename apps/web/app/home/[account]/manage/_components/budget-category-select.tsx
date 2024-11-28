'use client';

import React, { useState, useEffect, useRef, FocusEvent } from 'react';

import { CaretSortIcon } from '@radix-ui/react-icons';
import * as SelectPrimitive from '@radix-ui/react-select';

import { Input } from '@kit/ui/input';
import { cn } from '@kit/ui/utils';

import { useBudgetWorkspace } from '~/components/budget-workspace-context';
import { Category, CategoryGroup } from '~/lib/model/fin.types';
import { toast } from 'sonner';

interface CategorySelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  categoryGroups: CategoryGroup[];
  disabled?: boolean;
  placeholder?: string;
  selectedGroupId: string | null;
  onCreateNewCategory?: (categoryName: string) => void;
}

const MAX_NAME_LENGTH = 50;
const VALID_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9\s\-_]*$/;

const validateName = (name: string): { isValid: boolean; error?: string } => {
  if (!name) {
    return { isValid: false, error: 'Name is required' };
  }
  
  if (name.length > MAX_NAME_LENGTH || 
      !/^[a-zA-Z]/.test(name.charAt(0)) || 
      !VALID_NAME_REGEX.test(name)) {
    return { 
      isValid: false, 
      error: 'Name must start with a letter and can only contain letters, numbers, spaces, dashes, and underscores' 
    };
  }

  return { isValid: true };
};

const highlightMatch = (
  text: string | undefined,
  query: string | undefined,
) => {
  if (!text || !query) return text ?? '';
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  if (lowerText.startsWith(lowerQuery)) {
    return (
      <>
        <span className="font-bold">{text.slice(0, query.length)}</span>
        {text.slice(query.length)}
      </>
    );
  }
  return text;
};

const truncateText = 'truncate overflow-hidden text-ellipsis whitespace-nowrap';

export function BudgetCategorySelect({
  value,
  onValueChange,
  categoryGroups,
  disabled,
  placeholder = 'Select category',
  selectedGroupId,
}: CategorySelectProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const { workspace, addBudgetCategory } = useBudgetWorkspace();
  
  const budgetId = workspace.budget.id;
  
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = 0;
    }

    const scrollToFirstMatch = () => {
      if (searchQuery) {
        const allItems = viewportRef.current?.querySelectorAll(
          '[data-radix-select-item]',
        );
        const firstPrefixMatch = Array.from(allItems ?? []).find((item) => {
          const text = item.textContent ?? '';
          return text.toLowerCase().startsWith(searchQuery.toLowerCase());
        });

        if (firstPrefixMatch) {
          firstPrefixMatch.scrollIntoView({ block: 'start' });
          if (viewportRef.current) {
            viewportRef.current.scrollTop -= 8;
          }
        }
      }
    };

    console.log('Selected group id', selectedGroupId);

    const timeoutId = setTimeout(scrollToFirstMatch, 50);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, value, selectedGroupId]);

  const filterAndSortCategories = (categories: Category[], query: string) => {
    if (!query) return categories;
    const lowerQuery = query.toLowerCase();
    return categories
      .filter((category) => category.name.toLowerCase().includes(lowerQuery)) 
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const createNewCategory = async (
    budgetId: string,
    categoryName: string,
    description: string,
    groupId: string,
  ) => {
    try {
      console.log('budget id', budgetId);
      const response = await fetch('/api/budget/transactions/create-category', {
        method: 'PUT',
        body: JSON.stringify({ categoryName, description, groupId, budgetId }),
      });
      if (!response.ok) {
        throw new Error('Failed to create category');
      }
      const data = await response.json();
      console.log('data', data);
      addBudgetCategory(groupId, data.category);
      return data.category; 
    } catch (error) {
      console.error('Error creating new category:', error);
      throw error;
    }
  };

  const handleCreateNew = async () => {
    try {
      console.log('handleCreateNew called');
      
      if (!selectedGroupId) {
        toast.error('No group selected for new category');
        return;
      }

      const validation = validateName(searchQuery);
      if (!validation.isValid) {
        toast.error(validation.error);
        return;
      }

      const formattedName = searchQuery.charAt(0).toUpperCase() + searchQuery.slice(1);

      setIsCreatingGroup(true);
      console.log(`Create new category: ${formattedName}`);
      const createdCategory = await createNewCategory(
        budgetId,
        formattedName,
        '',
        selectedGroupId,
      );
      onValueChange(createdCategory.id); 
      setSearchQuery('');
      setIsOpen(false);
      setIsCreatingGroup(false);
    } catch (error) {
      console.error('Error creating new category:', error);
      setIsCreatingGroup(false);
      toast.error('Failed to create new category');
    }
  };

  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={(newValue) => {
        const selectedCategory = categoryGroups
          .flatMap((group) => group.categories)
          .find((category) => category.id === newValue);
        if (selectedCategory) {
          onValueChange(selectedCategory.id); 
          setIsOpen(false);
        }
      }}
      open={isOpen}
      onOpenChange={(open) => {
        if (open) {
          setSearchQuery('');
          setTimeout(() => {
            inputRef.current?.focus();
          }, 0);
          setIsOpen(true);
        } else {
          setIsOpen(false);
          setSearchQuery('');
        }
      }}
    >
      <SelectPrimitive.Trigger
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        )}
        disabled={disabled}
      >
        <SelectPrimitive.Value placeholder={placeholder}>
          <span className={truncateText}>
            {value &&
              categoryGroups
                .flatMap((g) => g.categories)
                .find((category) => category.id === value)?.name}
          </span>
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon>
          <CaretSortIcon className="h-4 w-4 opacity-50" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
          position="popper"
          sideOffset={5}
          onFocusCapture={(e: FocusEvent<HTMLDivElement>) => {
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
                const matchingGroup = categoryGroups.find((group) =>
                  group.name
                    .toLowerCase()
                    .includes(e.target.value.toLowerCase()),
                );

                if (!matchingGroup && value) {
                  const parentGroup = categoryGroups.find((group) =>
                    group.categories.some((category) => category.id === value),
                  );
                  if (parentGroup) {
                    console.log('Parent group found:', parentGroup.name);
                  }
                }
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
            {searchQuery &&
              selectedGroupId &&
              categoryGroups.find(g => g.id === selectedGroupId)?.budgetId != null &&
              !categoryGroups
                .find(g => g.id === selectedGroupId)
                ?.categories.some(category => 
                  category.name.toLowerCase().startsWith(searchQuery.toLowerCase())
                ) && (
                <div
                  onClick={() => {
                    if (!isCreatingGroup) {
                      void handleCreateNew();
                      console.log('Create new item clicked');
                    }
                  }}
                  className={cn(
                    'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
                    isCreatingGroup
                      ? 'cursor-not-allowed opacity-50'
                      : 'hover:bg-accent hover:text-accent-foreground',
                  )}
                  style={{
                    pointerEvents: isCreatingGroup ? 'none' : 'auto',
                  }}
                >
                  <span className="flex-1">
                    Create new category &quot;{searchQuery}&quot;
                  </span>
                  {isCreatingGroup && (
                    <div className="flex h-4 w-4 items-center justify-center">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  )}
                </div>
              )}
            {categoryGroups
              .filter((group) => group.id === selectedGroupId) 
              .map((group) =>
                filterAndSortCategories(group.categories, searchQuery).map(
                  (category) => (
                    <SelectPrimitive.Item
                      key={category.id}
                      value={category.id}
                      className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    >
                      <SelectPrimitive.ItemText>
                        <span className={truncateText}>
                          {highlightMatch(category.name, searchQuery)}
                        </span>
                      </SelectPrimitive.ItemText>
                    </SelectPrimitive.Item>
                  ),
                ),
              )}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
