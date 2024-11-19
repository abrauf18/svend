'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
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

interface CategorySelectProps {
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

export function CategorySelect({
  value,
  onValueChange,
  categoryGroups,
  disabled,
  placeholder = "Select category"
}: CategorySelectProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  
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

  const filterAndSortCategories = (categories: Category[], query: string) => {
    if (!query) return categories;
    
    return categories
      .filter(category => 
        category.name.toLowerCase().startsWith(query.toLowerCase())
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  return (
    <SelectPrimitive.Root 
      value={value} 
      onValueChange={(newValue) => {
        onValueChange(newValue);
        setSearchQuery('');
      }}
      onOpenChange={(open) => {
        if (open) {
          setSearchQuery('');
          setTimeout(() => {
            inputRef.current?.focus();
          }, 0);
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
          {value && categoryGroups.flatMap(g => g.categories).find(c => c.id === value)?.name}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon>
          <CaretSortIcon className="h-4 w-4 opacity-50" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          position="popper"
          sideOffset={5}
          onFocusCapture={(e: any) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <div 
            className="w-full border-b p-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
            }}
          >
            <Input
              ref={inputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search categories..."
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
            className="p-1 max-h-[300px] overflow-y-auto"
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
                      <SelectPrimitive.Item
                        key={category.id}
                        value={category.id}
                        className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                      >
                        <span className="left-1 mr-1 flex h-3.5 w-3.5 items-center justify-center">
                          <SelectPrimitive.ItemIndicator>
                            <CheckIcon className="h-4 w-4" />
                          </SelectPrimitive.ItemIndicator>
                        </span>
                        <SelectPrimitive.ItemText>
                          {searchQuery ? (
                            highlightMatch(category.name, searchQuery)
                          ) : (
                            category.name
                          )}
                        </SelectPrimitive.ItemText>
                      </SelectPrimitive.Item>
                    ))}
                  </div>
                </div>
              );
            })}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
} 