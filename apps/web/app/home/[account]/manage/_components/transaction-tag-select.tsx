'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons';
import { cn } from '@kit/ui/utils';
import { Input } from '@kit/ui/input';
import { FinAccountTransactionBudgetTag } from '~/lib/model/fin.types';
import { useBudgetWorkspace } from '~/components/budget-workspace-context';

interface TransactionTagSelectProps {
  transactionId: string;
  onTagsChange: (newTags: FinAccountTransactionBudgetTag[]) => void;
  disabled?: boolean;
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

const isValidTagName = (name: string): boolean => {
  if (/[^a-zA-Z0-9][^a-zA-Z0-9]/.test(name)) return false;
  return /^[a-zA-Z0-9\s\-_.]+$/.test(name);
};

export function TransactionTagSelect(props: TransactionTagSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [availableTags, setAvailableTags] = useState<FinAccountTransactionBudgetTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<FinAccountTransactionBudgetTag[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isCreatingTag, setIsCreatingTag] = useState(false);

  const { workspace, addBudgetTag } = useBudgetWorkspace();

  useEffect(() => {
    setAvailableTags(workspace.budgetTags ?? []);
  }, [workspace.budgetTags]);

  useEffect(() => {
    setSelectedTags((workspace.budgetTransactions ?? []).find(t => t.id === props.transactionId)?.budgetTags ?? []);
  }, [workspace.budgetTransactions]);

  useEffect(() => {
    props.onTagsChange(selectedTags);
  }, [selectedTags]);

  const handleCreateTag = async () => {
    setIsCreatingTag(true);
    try {
      const response = await fetch(`/api/budgets/${workspace.budget.id}/tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          tagName: tagSearchQuery 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create tag');
      }

      const { tag: newTag } = await response.json();
      addBudgetTag(newTag);
      
      // Update selected tags and notify parent
      const updatedSelectedTags = [...selectedTags, newTag];
      setSelectedTags(updatedSelectedTags);

      setTagSearchQuery('');
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to create tag:', error);
      // You might want to add error handling UI here
    } finally {
      setIsCreatingTag(false);
    }
  };

  return (
    <div className="relative">
      <div
        onClick={() => !props.disabled && setIsOpen(true)}
        className={cn(
          'flex min-h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-2 py-0.5 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <div className="flex flex-wrap gap-1 overflow-hidden">
          {selectedTags.length > 0 ? (
            selectedTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex max-w-[300px] items-center rounded bg-accent px-2 py-[0.125rem] text-sm font-medium text-accent-foreground"
              >
                <span className="truncate">
                  {tag.name}
                </span>
              </span>
            ))
          ) : (
            <span className="text-muted-foreground">Select tags...</span>
          )}
        </div>
        <CaretSortIcon className="h-4 w-4 flex-shrink-0 opacity-50" />
      </div>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0"
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute z-[60] mt-1 w-full rounded-md border bg-popover">
            <div className="relative w-full rounded-md shadow-[0_4px_12px_rgba(255,255,255,0.2)] bg-popover">
              <div 
                className="w-full border-b p-2"
              >
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Search or create tag..."
                  value={tagSearchQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || isValidTagName(value)) {
                      setTagSearchQuery(value);
                    }
                  }}
                  className="border-b border-gray-300 bg-transparent focus-visible:ring-0"
                  disabled={isCreatingTag}
                />
              </div>

              <div ref={viewportRef} className="p-1 max-h-[300px] overflow-y-auto">
                {tagSearchQuery &&
                  isValidTagName(tagSearchQuery) &&
                  !workspace.budgetTags.some(
                    (tag) => tag.name.toLowerCase() === tagSearchQuery.toLowerCase(),
                  ) &&
                  !selectedTags.some(st => st.name.toLowerCase() === tagSearchQuery.toLowerCase()) && (
                    <div
                      className={cn(
                        "relative flex w-full select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none",
                        isCreatingTag
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer hover:bg-accent hover:text-accent-foreground"
                      )}
                      onClick={isCreatingTag ? undefined : handleCreateTag}
                    >
                      <span className="flex-1">Create tag &quot;{tagSearchQuery}&quot;</span>
                      {isCreatingTag && (
                        <div className="flex h-4 w-4 items-center justify-center">
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                      )}
                    </div>
                  )}

                <div className="space-y-1 p-2">
                  {[
                    ...selectedTags.filter(tag => tag.name.toLowerCase().startsWith(tagSearchQuery.toLowerCase())),
                    ...availableTags.filter(
                      (tag) =>
                        !selectedTags.some(st => st.id === tag.id) &&
                        tag.name.toLowerCase().startsWith(tagSearchQuery.toLowerCase()),
                    ),
                  ].map((tag) => (
                    <div
                      key={tag.id}
                      className={cn(
                        "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                        selectedTags.some(st => st.id === tag.id) && "bg-accent text-accent-foreground"
                      )}
                      onClick={() => {
                        const isSelected = selectedTags.some(t => t.id === tag.id);
                        const updatedTags = isSelected
                          ? selectedTags.filter(t => t.id !== tag.id)
                          : [...selectedTags, tag];
                        
                        setSelectedTags(updatedTags);
                      }}
                    >
                      <span className="left-1 mr-1 flex h-3.5 w-3.5 items-center justify-center">
                        {selectedTags.some(st => st.id === tag.id) && (
                          <CheckIcon className="h-4 w-4" />
                        )}
                      </span>
                      <span className="truncate">
                        {tagSearchQuery ? highlightMatch(tag.name, tagSearchQuery) : tag.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 