'use client';

import React, { useState } from 'react';
import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons';
import { cn } from '@kit/ui/utils';
import { Input } from '@kit/ui/input';

interface Category {
  id: string;
  name: string;
}

interface CategoryGroup {
  id: string;
  name: string;
  categories: Category[];
}

interface TransactionCategorySelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  categoryGroups: CategoryGroup[];
  disabled?: boolean;
  placeholder?: string;
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
  placeholder = "Select category"
}: TransactionCategorySelectProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  
  React.useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = 0;
    }
    
    setTimeout(() => {
      if (searchQuery) {
        const allItems = viewportRef.current?.querySelectorAll('[data-radix-select-item]');
        const firstPrefixMatch = Array.from(allItems || []).find(item => {
          const text = item.textContent || '';
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
      <div
        onClick={() => !disabled && setIsOpen(true)}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <span className="truncate">
          {value 
            ? categoryGroups.flatMap(g => g.categories).find(c => c.id === value)?.name
            : placeholder
          }
        </span>
        <CaretSortIcon className="h-4 w-4 opacity-50" />
      </div>

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
              className="p-1 h-[40vh] max-h-[300px] overflow-y-auto"
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
  );
} 