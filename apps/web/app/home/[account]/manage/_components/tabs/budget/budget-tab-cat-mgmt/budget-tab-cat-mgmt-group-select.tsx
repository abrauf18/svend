'use client';

import React, { useEffect, useRef, useState, FocusEvent } from 'react';
import { CaretSortIcon, LockClosedIcon } from '@radix-ui/react-icons';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Input } from '@kit/ui/input';
import { cn } from '@kit/ui/utils';
import { useBudgetWorkspace } from '~/components/budget-workspace-context';
import { toast } from 'sonner';
import { CategoryGroup } from '~/lib/model/fin.types';

const MAX_NAME_LENGTH = 50;
const truncateText = 'truncate max-w-[300px]';

interface CategoryManagementGroupSelectProps {
  value?: string | null;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const filterAndSortGroups = (groups: CategoryGroup[], query: string) => {
  if (!query) return groups;
  return groups
    .filter(group => group.name.toLowerCase().startsWith(query.toLowerCase()))
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

export function CategoryManagementGroupSelect({
  value,
  onValueChange,
  disabled,
  placeholder = 'Select group',
}: CategoryManagementGroupSelectProps) {
  const { workspace, addBudgetCategoryGroup } = useBudgetWorkspace();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  
  const categoryGroups = Object.values(workspace.budgetCategories)
    .filter(group => group.name !== workspace.budget.id);
  const budgetId = workspace.budget.id;

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
    const isNameTaken = categoryGroups.some(group => 
      group.name.toLowerCase().trim() === normalizedName
    );
    if (isNameTaken) {
      return { isValid: false, error: 'A group with this name already exists in your budget' };
    }
  
    return { isValid: true, error: null };
  };

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

    const timeoutId = setTimeout(scrollToFirstMatch, 50);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, value]);

  const createNewGroup = async (
    budgetId: string,
    groupName: string,
    description: string,
  ) => {
    try {
      const response = await fetch('/api/budget/transactions/create-group', {
        method: 'PUT',
        body: JSON.stringify({ groupName, description, budgetId }),
      });
      const data = await response.json();
      console.log('data', data);
      addBudgetCategoryGroup(data.categoryGroup as CategoryGroup);
      return data.categoryGroup;
    } catch (error) {
      console.error('Error creating new group:', error);
    }
  };

  const handleCreateNew = async () => {
    try {
      const validation = validateName(searchQuery);
      if (!validation.isValid) {
        toast.error(`Unable to create group. ${validation.error}. The group name must: (1) Be between 1-50 characters (2) Start with a letter (3) Contain only letters, numbers, spaces, and basic punctuation (4) Be unique in your budget. Please try again with a valid name.`, {
          className: "bg-destructive text-destructive-foreground",
          descriptionClassName: "text-destructive-foreground",
          duration: 6000
        });
        return;
      }

      const formattedName = searchQuery.charAt(0).toUpperCase() + searchQuery.slice(1);

      setIsCreatingGroup(true);
      const newGroup = await createNewGroup(budgetId, formattedName, '');
      if (!newGroup?.id) {
        throw new Error('Invalid group returned from server');
      }

      setSearchQuery('');
      onValueChange(newGroup.id);
      setIsOpen(false);
      toast.success('Group created successfully');
    } catch (error: any) {
      console.error('Error creating new group:', error);
      const errorMessage = error?.message || '';
      
      if (errorMessage.toLowerCase().includes('duplicate')) {
        toast.error('A group with this name already exists. Please choose a different name.', {
          className: "bg-destructive text-destructive-foreground",
          descriptionClassName: "text-destructive-foreground"
        });
      } else {
        toast.error('Unable to create group. The group name must: (1) Be between 1-50 characters (2) Start with a letter (3) Contain only letters, numbers, spaces, and basic punctuation (4) Be unique in your budget. Please try again with a valid name.', {
          className: "bg-destructive text-destructive-foreground",
          descriptionClassName: "text-destructive-foreground",
          duration: 6000
        });
      }
    } finally {
      setIsCreatingGroup(false);
    }
  };

  return (
    <SelectPrimitive.Root
      value={value ?? undefined}
      onValueChange={(newValue) => {
        const selectedGroup = categoryGroups.find(
          (group) => group.id === newValue,
        );
        if (selectedGroup) {
          onValueChange(selectedGroup.id);
          setSearchQuery(''); 
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
          setSearchQuery(''); 
          setIsOpen(false);
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
          <div className="flex items-center">
            {value && categoryGroups.find((g) => g.id === value)?.budgetId == null && (
              <LockClosedIcon className="mr-2 h-4 w-4 opacity-70" />
            )}
            <span className={`${truncateText}`}>
              {value && categoryGroups.find((g) => g.id === value)?.name}
            </span>
          </div>
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
          onFocusCapture={(e: FocusEvent) => {
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
              placeholder="Search for groups"
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
              !categoryGroups.some((group) =>
                group.name.toLowerCase() === searchQuery.toLowerCase()
              ) && (
                <div
                  onClick={() => {
                    void handleCreateNew();
                    console.log('Create new item clicked');
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
                    Create new group &quot;{searchQuery}&quot;
                  </span>
                  {isCreatingGroup && (
                    <div className="flex h-4 w-4 items-center justify-center">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  )}
                </div>
              )}

            {(!searchQuery || filterAndSortGroups(categoryGroups, searchQuery).length > 0) &&
              filterAndSortGroups(categoryGroups, searchQuery).map((group) => (
                <SelectPrimitive.Item
                  key={group.id}
                  value={group.id}
                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                >
                  {group.budgetId == null && (
                    <LockClosedIcon className="mr-2 h-4 w-4 opacity-70" />
                  )}
                  <SelectPrimitive.ItemText>
                    <span className={truncateText}>
                      {highlightMatch(group.name, searchQuery)}
                    </span>
                  </SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
