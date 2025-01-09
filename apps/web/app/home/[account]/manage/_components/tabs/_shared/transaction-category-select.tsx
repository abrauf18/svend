'use client';

import React, { useState, useEffect } from 'react';
import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons';
import { cn } from '@kit/ui/utils';
import { Input } from '@kit/ui/input';
import { Button } from '@kit/ui/button';
import { ListTree, Plus } from 'lucide-react';
import { CategoryComponentRow } from '../_shared/category-component-row';
import { Category, CategoryGroup } from '~/lib/model/fin.types';
import { Label } from '@kit/ui/label';

interface TransactionCategorySelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  categoryGroups: CategoryGroup[];
  disabled?: boolean;
  placeholder?: string;
  isSplitMode?: boolean;
  budgetId?: string;
  onSplitComponentsChange?: (components: Array<{
    categoryId: string;
    weight: number;
  }>) => void;
  splitComponents?: Array<{
    categoryId: string;
    weight: number;
  }>;
  className?: string;
}

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

export function TransactionCategorySelect({
  value,
  onValueChange,
  categoryGroups,
  disabled,
  placeholder = "Select category",
  isSplitMode,
  onSplitComponentsChange,
  budgetId,
  splitComponents,
  className
}: TransactionCategorySelectProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [componentRows, setComponentRows] = useState<Array<{
    categoryName: string;
    weight: number;
    categoryId?: string;
  }>>(
    splitComponents?.map(comp => ({
      categoryName: categoryGroups.flatMap(g => g.categories).find(c => c.id === comp.categoryId)?.name ?? '',
      weight: comp.weight,
      categoryId: comp.categoryId
    })) ?? [
      { categoryName: '', weight: 0, categoryId: '' },
      { categoryName: '', weight: 0, categoryId: '' }
    ]
  );

  const filteredCategoryGroups = categoryGroups.filter(group => 
    group.name !== budgetId
  );

  useEffect(() => {
    if (isSplitMode && onSplitComponentsChange) {
      const components = componentRows.map(row => ({
        categoryId: row.categoryId ?? '',
        weight: row.weight ?? 0
      }));
      onSplitComponentsChange(components);
    }
  }, [isSplitMode, componentRows, onSplitComponentsChange]);

  React.useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = 0;
    }
    
    setTimeout(() => {
      if (searchQuery) {
        const allItems = viewportRef.current?.querySelectorAll('[data-radix-select-item]');
        const firstPrefixMatch = Array.from(allItems ?? []).find(item => {
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
    }, 50);
  }, [searchQuery, value]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  React.useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const filterAndSortCategories = (categories: Category[], query: string) => {
    if (!query) return categories;
    
    return categories
      .filter(category => 
        category.name.toLowerCase().startsWith(query.toLowerCase())
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  return (
    <div ref={containerRef} className="relative">
      {!isSplitMode && (
        <div
          onClick={() => !disabled && setIsOpen(true)}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <div className="flex items-center truncate">
            {value && categoryGroups.flatMap(g => g.categories).find(c => c.id === value)?.isComposite && (
              <ListTree className="mr-2 h-4 w-4 opacity-70" />
            )}
            <span className="truncate">
              {value 
                ? categoryGroups.flatMap(g => g.categories).find(c => c.id === value)?.name
                : placeholder
              }
            </span>
          </div>
          <CaretSortIcon className="h-4 w-4 opacity-50" />
        </div>
      )}

      {isOpen && (
        <div className="absolute z-[60] mt-1 w-full rounded-md border bg-popover">
          <div className="relative w-full rounded-md shadow-[0_4px_12px_rgba(255,255,255,0.2)] bg-popover">
            <div 
              className="w-full border-b p-2"
            >
              <Input
                ref={inputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search categories..."
                className="border-b border-gray-300 bg-transparent focus-visible:ring-0"
              />
            </div>
            
            <div 
              ref={viewportRef}
              className={cn(
                "p-1 h-[40vh] max-h-[300px] overflow-y-auto",
                className
              )}
            >
              {categoryGroups.map((group) => {
                const filteredCategories = filterAndSortCategories(group.categories, searchQuery);
                
                if (filteredCategories.length === 0) return null;
                
                return (
                  <div key={group.id} className="mb-2">
                    <div className="px-2 text-sm text-muted-foreground">
                      {group.name}
                    </div>
                    <div className="space-y-1 p-2">
                      {filteredCategories.map((category) => (
                        <div
                          key={category.id}
                          className={cn(
                            "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                            value === category.id && "bg-accent text-accent-foreground"
                          )}
                          onClick={() => {
                            onValueChange(category.id);
                            setSearchQuery('');
                            setIsOpen(false);
                          }}
                        >
                          <span className="left-1 mr-1 flex h-3.5 w-3.5 items-center justify-center">
                            {value === category.id && (
                              <CheckIcon className="h-4 w-4" />
                            )}
                          </span>
                          <div className="flex items-center">
                            {category.isComposite && (
                              <ListTree className="mr-2 h-4 w-4 opacity-70" />
                            )}
                            <span className="truncate">
                              {searchQuery ? highlightMatch(category.name, searchQuery) : category.name}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {isSplitMode && (
        <div className="space-y-2">
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-4">
              <Label>Components</Label>
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
              <div className="grid grid-cols-12 gap-2 px-2">
                <div className="col-span-7">
                  <span className="text-sm font-medium text-muted-foreground truncate block">Category</span>
                </div>
                <div className="col-span-3 text-right">
                  <span className="text-sm font-medium text-muted-foreground">Weight</span>
                </div>
                <div className="col-span-4" /> {/* Spacer for delete button */}
              </div>

              {/* Component Rows */}
              {componentRows.map((row, index) => (
                <div key={index} className="border-b border-border/80 last:border-0 pb-4 last:pb-0 first:pt-0">
                  <CategoryComponentRow
                    rowIndex={index}
                    canDelete={componentRows.length > 2 && index >= 2}
                    categoryName=""
                    categoryGroups={categoryGroups}
                    value={row}
                    onChange={(newValue) => {
                      setComponentRows(prev => {
                        const newRows = [...prev];
                        newRows[index] = newValue;
                        return newRows;
                      });
                    }}
                    onDelete={() => {
                      if (index >= 2) {
                        setComponentRows(prev => prev.filter((_, i) => i !== index));
                      }
                    }}
                    selectedCategories={componentRows
                      .filter((_, i) => i !== index)
                      .map(r => r.categoryName)
                      .filter(Boolean)}
                    widthToTextEllipsis={140}
                    className="grid grid-cols-1 [&>*]:mb-2 @[300px]:grid-cols-[minmax(140px,1fr)_80px_32px] gap-2"
                  />
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="grid grid-cols-12 gap-2 px-2">
                <div className="col-span-7">
                  <span className="text-sm font-medium text-muted-foreground">Total Weight</span>
                </div>
                <div className="col-span-3 text-right">
                  <span className={cn(
                    "text-sm font-medium block text-right",
                    componentRows.reduce((sum, row) => sum + row.weight, 0) === 100 
                      ? "text-green-500" 
                      : "text-red-500"
                  )}>
                    {componentRows.reduce((sum, row) => sum + row.weight, 0)} %
                  </span>
                </div>
                <div className="col-span-4" /> {/* Spacer for consistency */}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 