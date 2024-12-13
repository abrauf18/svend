'use client';

import React, { useState, useRef, useEffect, FocusEvent, useMemo } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { CaretSortIcon, LockClosedIcon } from '@radix-ui/react-icons';
import { cn } from '@kit/ui/utils';
import { Input } from '@kit/ui/input';
import { Category } from '~/lib/model/fin.types';
import { toast } from 'sonner';

interface CategoryManagementCatSelectProps {
  onValueChange: (value: string | undefined) => void;
  onCreateCategory?: (category: Category) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  categories: Category[];
  value?: string;
  isBuiltIn?: boolean;
  budgetId?: string;
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
  onCreateCategory,
  disabled,
  placeholder = "Select category",
  categories,
  value,
  isBuiltIn,
  budgetId,
  groupId,
}: CategoryManagementCatSelectProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Update filtered categories when search or categories change
  useEffect(() => {
    const filtered = filterAndSortCategories(categories, searchQuery);
    setFilteredCategories(filtered);
  }, [categories, searchQuery]);

  const handleValueChange = (newValue: string) => {
    if (!newValue) {
      onValueChange(undefined);
      setSearchQuery('');
      return;
    }
    
    onValueChange(newValue);
    setSearchQuery('');
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
    const isNameTaken = categories.some(category => 
      category.name.toLowerCase().trim() === normalizedName
    );
    if (isNameTaken) {
      return { isValid: false, error: 'A category with this name already exists in your budget' };
    }
  
    return { isValid: true, error: null };
  };

  const createNewCategory = async (
    categoryName: string,
    description: string,
  ): Promise<Category> => {
    try {
      const response = await fetch('/api/budget/transactions/create-category', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryName,
          description,
          budgetId,
          groupId
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
      const resCat = await createNewCategory(formattedName, '');
      
      if (!resCat?.id) {
        throw new Error('Invalid category returned from server');
      }

      onCreateCategory?.(resCat);
      onValueChange(resCat.id);
      setSearchQuery('');
      setIsOpen(false);

      toast.success('Category created successfully');
    } catch (error: any) {
      console.error('Error creating new category:', error);
      const errorMessage = error?.message || '';
      
      if (errorMessage.toLowerCase().includes('name already exists')) {
        toast.error('A category with this name already exists in this group. Please choose a different name.', {
          className: "bg-destructive text-destructive-foreground",
          descriptionClassName: "text-destructive-foreground"
        });
      } else {
        toast.error('Unable to create category.', {
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
      value={value ?? undefined}
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
        <div className="flex items-center">
          {isBuiltIn && <LockClosedIcon className="mr-2 h-3 w-3 opacity-70" />}
          <SelectPrimitive.Value placeholder={placeholder}>
            {value && categories.find(c => c.id === value)?.name || placeholder}
          </SelectPrimitive.Value>
        </div>
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
              !categories.some(category =>
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

            {categories && (
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
            )}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
} 
