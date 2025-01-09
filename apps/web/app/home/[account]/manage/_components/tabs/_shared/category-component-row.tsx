'use client';

import React, { useState, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { CategoryGroup } from '~/lib/model/fin.types';
import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons';
import { cn } from '@kit/ui/utils';

interface CategoryComponentRowProps {
  rowIndex: number;
  canDelete: boolean;
  categoryName: string;
  categoryGroups: CategoryGroup[];
  value: {
    categoryName: string;
    weight: number;
    categoryId?: string;
  };
  onChange: (newValue: { categoryName: string; weight: number; categoryId?: string }) => void;
  onDelete: () => void;
  selectedCategories: string[];
  widthToTextEllipsis: number;
  className?: string;
  currentCategoryId?: string;
}

export function CategoryComponentRow({
  canDelete,
  categoryName,
  categoryGroups,
  value,
  onChange,
  onDelete,
  selectedCategories,
  widthToTextEllipsis,
  className,
  currentCategoryId
}: CategoryComponentRowProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

  const filterCategories = (categories: Array<{ id: string; name: string }>, query: string) => {
    if (!query) return categories;
    return categories.filter(cat => 
      cat.name.toLowerCase().startsWith(query.toLowerCase())
    );
  };

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

  return (
    <div className={className}>
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-12">
          <div ref={containerRef} className="relative">
            <div
              onClick={() => setIsOpen(!isOpen)}
              className={cn(
                'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <span 
                className="truncate text-ellipsis overflow-hidden whitespace-nowrap"
                style={{ width: `${widthToTextEllipsis}px` }}
              >
                {value.categoryName || 'Select category'}
              </span>
              <CaretSortIcon className="h-4 w-4 opacity-50" />
            </div>

            {isOpen && (
              <div className="absolute z-[60] mt-1 w-full rounded-md border bg-popover">
                <div className="relative w-full rounded-md shadow-[0_4px_12px_rgba(255,255,255,0.2)] bg-popover">
                  <div className="w-full border-b p-2">
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
                    className="p-1 h-[40vh] max-h-[300px] overflow-y-auto"
                  >
                    {categoryGroups.map((group) => {
                      const categories = group.categories.filter(cat => {
                        const isCurrentSelection = cat.name === value.categoryName;
                        const isSelectedInOtherRow = selectedCategories.includes(cat.name) && !isCurrentSelection;
                        const isCurrentCategory = cat.id === currentCategoryId;
                        
                        return cat.name !== categoryName && 
                               !cat.isComposite && 
                               !isSelectedInOtherRow &&
                               !isCurrentCategory;
                      });

                      const filteredCategories = filterCategories(categories, searchQuery);
                      
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
                                  value.categoryName === category.name && "bg-accent text-accent-foreground"
                                )}
                                onClick={() => {
                                  onChange({
                                    categoryName: category.name,
                                    weight: value.weight,
                                    categoryId: category.id
                                  });
                                  setSearchQuery('');
                                  setIsOpen(false);
                                }}
                              >
                                <span className="left-1 mr-1 flex h-3.5 w-3.5 items-center justify-center">
                                  {value.categoryName === category.name && (
                                    <CheckIcon className="h-4 w-4" />
                                  )}
                                </span>
                                <span className="truncate">
                                  {searchQuery ? highlightMatch(category.name, searchQuery) : category.name}
                                </span>
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
          </div>
        </div>
        <div className="col-start-8 col-span-3 flex justify-center">
          <div className="relative">
            <Input
              type="number"
              min="0"
              max="100"
              value={value.weight || ''}
              placeholder="0"
              onChange={(e) => {
                const numValue = parseInt(e.target.value, 10);
                if (!e.target.value) {
                  onChange({ 
                    ...value,
                    weight: 0
                  });
                  return;
                }
                if (!isNaN(numValue)) {
                  onChange({ 
                    ...value,
                    weight: Math.min(numValue, 100)
                  });
                }
              }}
              className="text-right pr-6 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
          </div>
        </div>
        <div className="col-span-2 flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-9 w-9"
            disabled={!canDelete}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CategoryComponentRow;