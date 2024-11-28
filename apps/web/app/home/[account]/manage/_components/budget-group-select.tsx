'use client';

import React, { useEffect, useRef, useState, FocusEvent } from 'react';

import { CaretSortIcon, LockClosedIcon } from '@radix-ui/react-icons';
import * as SelectPrimitive from '@radix-ui/react-select';

import { Input } from '@kit/ui/input';
import { cn } from '@kit/ui/utils';

import { useBudgetWorkspace } from '~/components/budget-workspace-context';
import { CategoryGroup } from '~/lib/model/fin.types';
import { toast } from 'sonner';

interface CategorySelectProps {
  value?: string | null;
  onValueChange: (value: string) => void;
  categoryGroups: CategoryGroup[];
  disabled?: boolean;
  placeholder?: string;
  onCreateNewCategory?: (categoryName: string) => void;
}

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

const filterAndSortGroups = (groups: CategoryGroup[], query: string) => {
  if (!query) {
    // Split into built-in and custom groups
    const builtIn = groups.filter(group => group.budgetId == null);
    const custom = groups.filter(group => group.budgetId != null);

    // Sort built-in groups: Income first, then alphabetically
    const sortedBuiltIn = builtIn.sort((a, b) => {
      if (a.name.toLowerCase() === 'income') return -1;
      if (b.name.toLowerCase() === 'income') return 1;
      return a.name.localeCompare(b.name);
    });

    // Sort custom groups alphabetically
    const sortedCustom = custom.sort((a, b) => a.name.localeCompare(b.name));

    // Combine the arrays
    return [...sortedBuiltIn, ...sortedCustom];
  }

  const lowerQuery = query.toLowerCase().trim();
  const filtered = groups.filter((group) => 
    group.name.toLowerCase().startsWith(lowerQuery)
  );

  // Apply the same sorting logic to filtered results
  const builtIn = filtered.filter(group => group.budgetId == null);
  const custom = filtered.filter(group => group.budgetId != null);

  const sortedBuiltIn = builtIn.sort((a, b) => {
    if (a.name.toLowerCase() === 'income') return -1;
    if (b.name.toLowerCase() === 'income') return 1;
    return a.name.localeCompare(b.name);
  });

  const sortedCustom = custom.sort((a, b) => a.name.localeCompare(b.name));

  return [...sortedBuiltIn, ...sortedCustom];
};

const truncateText = 'truncate overflow-hidden text-ellipsis whitespace-nowrap';

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

export function BudgetGroupSelect({
  value,
  onValueChange,
  categoryGroups,
  disabled,
  placeholder = 'Select group',
}: CategorySelectProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const { workspace, addBudgetCategoryGroup } = useBudgetWorkspace();
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const budgetId = workspace.budget.id;
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

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
      console.log('handleCreateNew called');
      
      const validation = validateName(searchQuery);
      if (!validation.isValid) {
        toast.error(validation.error);
        return;
      }

      // Capitalize the first letter
      const formattedName = searchQuery.charAt(0).toUpperCase() + searchQuery.slice(1);

      console.log(`Create new group: ${formattedName}`);
      setIsCreatingGroup(true);
      const newGroup = await createNewGroup(budgetId, formattedName, '');
      setSearchQuery('');
      onValueChange(newGroup.id); 
      setIsOpen(false);
      setIsCreatingGroup(false);
    } catch (error) {
      console.error('Error creating new group:', error);
      setIsCreatingGroup(false);
      toast.error('Failed to create new group');
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
              <LockClosedIcon className="mr-2 h-3 w-3 opacity-70" />
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

                if (matchingGroup) {
                  setSelectedGroupId(matchingGroup.id);
                } else if (value) {
                  const parentGroup = categoryGroups.find((group) =>
                    group.categories.some((category) => category.id === value),
                  );
                  if (parentGroup) {
                    setSelectedGroupId(parentGroup.id);
                  }
                }
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
                    <LockClosedIcon className="mr-2 h-3 w-3 opacity-70" />
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
