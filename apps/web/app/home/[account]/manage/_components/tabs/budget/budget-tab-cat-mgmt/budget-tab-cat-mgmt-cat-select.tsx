'use client';

import React, { useState, useRef, useEffect } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { CaretSortIcon, LockClosedIcon } from '@radix-ui/react-icons';
import { cn } from '@kit/ui/utils';
import { Input } from '@kit/ui/input';
import { Switch } from '@kit/ui/switch';
import { Label } from "@kit/ui/label";
import { Button } from '@kit/ui/button';
import { Category, CategoryCompositionData, CategoryGroup } from '~/lib/model/fin.types';
import { toast } from 'sonner';
import { ListTree, Plus } from 'lucide-react';
import { CategoryComponentRow } from '../../_shared/category-component-row';

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
  onCompositionDataChange?: (data: { 
    isCompositeMode: boolean;
    selectedCategories: CategoryCompositionData[];
  }) => void;
  budgetCategories: Record<string, CategoryGroup>;
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
  onCompositionDataChange,
  budgetCategories,
}: CategoryManagementCatSelectProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isCompositeMode, setIsCompositeMode] = useState(false);
  const [componentRows, setComponentRows] = useState<CategoryCompositionData[]>([]);
  const [isSelectingComponent, setIsSelectingComponent] = useState(false);

  const filteredCategoryGroups = Object.values(budgetCategories)
  .filter(group => group.name !== budgetId)
  .map(group => ({
    id: group.id,
    name: group.name,
    categories: group.categories,
    isEnabled: group.isEnabled,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt
  }));
  // Update filtered categories when search or categories change
  useEffect(() => {
    console.log('Effect filter:', {
      categories: categories.map(c => ({ id: c.id, name: c.name })),
      value,
      isCompositeMode,
      isSelectingComponent
    });
    
    const filtered = filterAndSortCategories(categories, searchQuery);
    setFilteredCategories(filtered);
  }, [categories, searchQuery, value]);

  const handleValueChange = (newValue: string) => {
    console.log('handleValueChange:', { newValue, isCompositeMode, isSelectingComponent });
    
    if (!newValue) {
      onValueChange(undefined);
      setSearchQuery('');
      setIsCompositeMode(false);
      setIsSelectingComponent(false);
      setComponentRows([]);
      onCompositionDataChange?.({
        isCompositeMode: false,
        selectedCategories: []
      });
      console.log('After reset:', { isCompositeMode, isSelectingComponent });
      return;
    }
    
    const selectedCategory = categories.find(c => c.id === newValue);

    if (selectedCategory?.isComposite && selectedCategory.compositeData) {
      setIsCompositeMode(true);
      setIsSelectingComponent(true);
      setComponentRows(selectedCategory.compositeData.map(comp => ({
        categoryName: comp.categoryName,
        weight: comp.weight,
        categoryId: comp.categoryId
      })));
      
      onCompositionDataChange?.({
        isCompositeMode: true,
        selectedCategories: selectedCategory.compositeData
      });
    } else {
      setIsCompositeMode(false);
      setIsSelectingComponent(false);
      setComponentRows([]);
      onCompositionDataChange?.({
        isCompositeMode: false,
        selectedCategories: []
      });
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
    compositeData?: {
      isComposite: boolean;
      compositeData: CategoryCompositionData[];
    }
  ): Promise<Category> => {
    try {
      const response = await fetch('/api/budget/transactions/create-category', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryName,
          description,
          budgetId,
          groupId,
          ...(compositeData && {
            isComposite: compositeData.isComposite,
            compositeData: compositeData.compositeData
          })
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

      // if there is a category selected, we create a normal category
      // independently of the isCompositeMode state
      if (value) {
        setIsCreatingCategory(true);
        const resCat = await createNewCategory(
          formattedName,
          '',
          undefined
        );
        
        if (!resCat?.id) {
          throw new Error('Invalid category returned from server');
        }

        onCreateCategory?.(resCat);
        onValueChange(resCat.id);
        setSearchQuery('');
        setIsOpen(false);

        toast.success('Category created successfully');
      } else {
        // if there is no category selected, then we consider isCompositeMode
        if (isCompositeMode) {
          const total = calculateTotal(componentRows.map(row => row.weight));
          if (total !== 100) {
            toast.error('Total weight must equal 100%');
            return;
          }

          const compositionDataArray = componentRows.map(row => {
            if (!row.categoryId) {
              console.error(`No categoryId found for: ${row.categoryName}`);
              throw new Error(`No categoryId found for: ${row.categoryName}`);
            }

            return {
              categoryId: row.categoryId,
              categoryName: row.categoryName,
              weight: row.weight
            };
          });

          setIsCreatingCategory(true);
          const resCat = await createNewCategory(
            formattedName,
            '',
            {
              isComposite: true,
              compositeData: compositionDataArray
            }
          );
          
          if (!resCat?.id) {
            throw new Error('Invalid category returned from server');
          }

          onCreateCategory?.(resCat);
          onValueChange(resCat.id);
          setSearchQuery('');
          setIsOpen(false);

          toast.success('Category created successfully');
        } else {
          setIsCreatingCategory(true);
          const resCat = await createNewCategory(
            formattedName,
            '',
            undefined
          );
          
          if (!resCat?.id) {
            throw new Error('Invalid category returned from server');
          }

          onCreateCategory?.(resCat);
          onValueChange(resCat.id);
          setSearchQuery('');
          setIsOpen(false);

          toast.success('Category created successfully');
        }
      }
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
          duration: 6000
        });
      }
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const calculateTotal = (percentages: number[]): number => {
    return percentages.reduce((sum, value) => sum + value, 0);
  };

  useEffect(() => {
    onCompositionDataChange?.({
      isCompositeMode,
      selectedCategories: componentRows.map(row => ({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        weight: row.weight
      }))
    });
  }, [isCompositeMode, componentRows, onCompositionDataChange]);

  // Add an effect to monitor state changes
  useEffect(() => {
    console.log('State changed:', { 
      value, 
      isCompositeMode, 
      isSelectingComponent,
      componentRows: componentRows.length 
    });
  }, [value, isCompositeMode, isSelectingComponent, componentRows]);

  // Also log in the render to see what's being used for conditions
  console.log('Render state:', { 
    value, 
    isBuiltIn, 
    isCompositeMode, 
    isSelectingComponent 
  });

  // Add this effect to watch for value changes
  useEffect(() => {
    if (!value) {
      setIsCompositeMode(false);
      setIsSelectingComponent(false);
      setComponentRows([]);
      onCompositionDataChange?.({
        isCompositeMode: false,
        selectedCategories: []
      });
    }
  }, [value, onCompositionDataChange]);

  return (
    <>
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
          {isBuiltIn ? (
            <LockClosedIcon className="mr-2 h-4 w-4 opacity-70" />
          ) : categories.find(c => c.id === value)?.isComposite ? (
            <ListTree className="mr-2 h-4 w-4 opacity-70" />
          ) : null}
          <SelectPrimitive.Value placeholder={placeholder}>
            {value && (categories.find(c => c.id === value)?.name ?? placeholder)}
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
                {<>
                  {console.log('Rendering categories:', {
                    filteredCategories: filteredCategories.map(c => ({ id: c.id, name: c.name })),
                    value,
                    isCompositeMode
                  })}
                </>}
                {filteredCategories.map((category) => (
                  <SelectPrimitive.Item
                    key={`${category.id}-${category.name}`}
                    value={category.id}
                    className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  >
                    {isBuiltIn ? (
                      <LockClosedIcon className="mr-2 h-4 w-4 opacity-70" />
                    ) : category.isComposite ? (
                      <ListTree className="mr-2 h-4 w-4 opacity-70" />
                    ) : null}
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

    {value && !isBuiltIn && (
      <div className="flex items-center gap-2 py-4 my-4">
        <Switch 
          id="composite-mode" 
          checked={isCompositeMode}
          onCheckedChange={(checked) => {
            setIsCompositeMode(checked);
            setIsSelectingComponent(checked);
            if (checked) {
              const selectedCategory = categories.find(c => c.id === value);
              if (selectedCategory?.compositeData) {
                setComponentRows(
                  selectedCategory.compositeData.map(comp => ({
                    categoryName: comp.categoryName,
                    weight: comp.weight,
                    categoryId: comp.categoryId
                  }))
                );
              } else {
                setComponentRows([
                  { categoryName: '', weight: 0, categoryId: '' },
                  { categoryName: '', weight: 0, categoryId: '' }
                ]);
              }
            } else {
              setComponentRows([]);
              setIsSelectingComponent(false);
            }
          }}
        />
        <Label
          htmlFor="composite-mode"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Split
        </Label>
      </div>
    )}

    {isCompositeMode && isSelectingComponent && (
      <div className="mt-6 space-y-6">
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium">Components</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setComponentRows(prev => [
                  ...prev,
                  { categoryName: '', weight: 0, categoryId: '' }
                ]);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Component
            </Button>
          </div>

          <div className="space-y-4">
            {/* Header */}
            <div className="grid grid-cols-[minmax(200px,1fr)_80px_32px] gap-2 px-2">
              <div>
                <span className="text-sm font-medium text-muted-foreground truncate max-w-[200px] block">Category</span>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Weight</span>
              </div>
              <div /> {/* Spacer for delete button column */}
            </div>

            {/* Component Rows */}
            {componentRows.map((row, index) => {
              const selectedCategoriesExceptCurrent = componentRows
                .filter((_, i) => i !== index)
                .map(r => r.categoryName)
                .filter(Boolean);

              return (
                <CategoryComponentRow
                  key={index}
                  canDelete={index >= 2}
                  categoryName={categories.find(c => c.id === row.categoryId)?.name ?? ''}
                  categoryGroups={filteredCategoryGroups}
                  value={row}
                  onChange={(newValue) => {
                    setComponentRows(prev => {
                      const newRows = [...prev];
                      newRows[index] = {
                        ...newValue,
                        categoryId: newValue.categoryId ?? ''
                      };
                      return newRows;
                    });
                  }}
                  onDelete={() => {
                    if (index >= 2) {
                      setComponentRows(prev => prev.filter((_, i) => i !== index));
                    }
                  }}
                  selectedCategories={selectedCategoriesExceptCurrent}
                  rowIndex={index}
                  widthToTextEllipsis={240}
                  currentCategoryId={value}
                />
              );
            })}
          </div>

          {/* Total */}
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-[minmax(200px,1fr)_60px_32px] gap-2 px-2">
              <div>
                <span className="text-sm font-medium text-muted-foreground">Total Weight</span>
              </div>
              <div className="relative">
                <span className={cn(
                  "text-sm font-medium block text-right pr-3",
                  componentRows.reduce((sum, row) => sum + row.weight, 0) === 100 
                    ? "text-green-500" 
                    : "text-red-500"
                )}>
                  {componentRows.reduce((sum, row) => sum + row.weight, 0)} %
                </span>
              </div>
              <div /> {/* Spacer to match delete button column */}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
} 
