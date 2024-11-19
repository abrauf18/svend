'use client';

import React, { useEffect, useState } from 'react';

import { format } from 'date-fns';
import { Calendar, Upload, X } from 'lucide-react';

import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';
import { Button } from '@kit/ui/button';
import { Calendar as CalendarComponent } from '@kit/ui/calendar';
import { Checkbox } from '@kit/ui/checkbox';
import { GlobalLoader } from '@kit/ui/global-loader';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@kit/ui/sheet';
import { Textarea } from '@kit/ui/textarea';
import { FinAccountTransaction, FinAccountTransactionBudgetTag } from '~/lib/model/fin.types';
import { useBudgetWorkspace } from '~/components/budget-workspace-context';

interface DisabledFields {
  date?: boolean;
  category?: boolean;
  payee?: boolean;
  notes?: boolean;
  amount?: boolean;
  recurring?: boolean;
  account?: boolean;
  attachments?: boolean;
}

interface TransactionPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: FinAccountTransaction;
  selectedRowData?: FinAccountTransaction;
  isReadOnly?: boolean;
  disabledFields?: DisabledFields;
  budgetId: string;
  refreshTrigger: () => void;
}

interface Category {
  id: string;
  name: string;
}

interface CategoryGroup {
  id: string;
  name: string;
  categories: Category[];
}

// Private function to parse date
const parseDate = (dateString: string): Date => {
  const date = new Date();
  date.setFullYear(Number(dateString.split('-')[0]));
  date.setMonth(Number(dateString.split('-')[1]) - 1);
  date.setDate(Number(dateString.split('-')[2]));
  return date;
};

export function TransactionPanel({
  open,
  onOpenChange,
  transaction,
  selectedRowData,
  isReadOnly = false,
  disabledFields = {},
  budgetId,
  refreshTrigger,
}: TransactionPanelProps) {
  const [date, setDate] = React.useState<Date>();
  const [isRecurring, setIsRecurring] = React.useState(false);
  const [categoryGroups, setCategoryGroups] = React.useState<CategoryGroup[]>(
    [],
  );
  const [searchQuery, setSearchQuery] = React.useState('');
  const [merchantName, setMerchantName] = React.useState(''); // New state for payee name
  const [amount, setAmount] = React.useState(0);
  const [notes, setNotes] = React.useState('');
  const [attachments, setAttachments] = React.useState<(File | string)[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [selectedTags, setSelectedTags] = React.useState<FinAccountTransactionBudgetTag[]>([]);
  const [tagSearchQuery, setTagSearchQuery] = React.useState('');

  const { workspace } = useBudgetWorkspace();

  useEffect(() => {
    if (selectedRowData) {
      console.log('selectedRowData in useEffect', selectedRowData);

      setDate(parseDate(selectedRowData.date)); // Ensure date is a Date object
      setMerchantName(selectedRowData.merchantName ?? '');
      setAmount(selectedRowData.amount ?? 0);
      setNotes(selectedRowData.notes ?? '');
      setSelectedTags(selectedRowData.budgetTags ?? []);
    }
  }, []);

  useEffect(() => {
    if (selectedRowData) {
      // Find matching category in nested categories
      if (categoryGroups.length > 0) {
        const matchingCategoryGroup = categoryGroups?.find((group) =>
          group.categories?.some(
            (category) => category?.name === selectedRowData?.svendCategory,
          ),
        );
        const matchingCategory = matchingCategoryGroup?.categories?.find(
          (category) => category.name === selectedRowData?.svendCategory,
        );
        setSelectedCategory(matchingCategory);

        // Only set attachments if they exist, otherwise set empty array
        setAttachments(selectedRowData.budgetAttachmentsStorageNames ?? []);
      }
    }
  }, [categoryGroups]);

  const [selectedCategory, setSelectedCategory] = React.useState<
    Category | undefined
  >();
  const supabase = getSupabaseBrowserClient();
  const [tags, setTags] = React.useState<FinAccountTransactionBudgetTag[]>([]);

  React.useEffect(() => {
    const fetchCategoryGroups = async () => {
      const { data, error } = await supabase.from('category_groups').select(`
          id,
          name,
          categories (
            id,
            name
          )
        `);

      if (error) {
        console.error('Error fetching category groups:', error);
      } else {
        console.log('Category groups:', data);
        setCategoryGroups(data);
      }
    };

    void fetchCategoryGroups();
  }, [supabase]);

  React.useEffect(() => {
    const fetchTags = async () => {
      console.log('fetching tags for budget_id', budgetId);
      const { data, error } = await supabase
        .from('budget_tx_tags')
        .select('*')
        .eq('budget_id', budgetId);
      if (error) {
        console.error('Error fetching tags:', error);
      } else {
        setTags(data);
      }
    };

    if (budgetId) {
      void fetchTags();
    }
  }, [supabase, budgetId, selectedRowData]);

  const [accounts, setAccounts] = useState<Record<string, { name: string; balance: number }>>({});
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Update the accounts useEffect
  useEffect(() => {
    const accountsData = workspace?.budget?.linkedFinAccounts?.reduce(
      (acc: Record<string, { name: string; balance: number }>, account) => {
        if (account.budgetFinAccountId) {
          acc[account.budgetFinAccountId] = {
            name: `${account.name} - ***${account.mask}`,
            balance: account.balance ?? 0,
          };
        }
        return acc;
      },
      {}
    );
    setAccounts(accountsData ?? {});

    // Set the selected account if we have transaction data
    if (selectedRowData?.budgetFinAccountId) {
      setSelectedAccountId(selectedRowData.budgetFinAccountId);
    }
  }, [workspace?.budget?.linkedFinAccounts, selectedRowData]);

  // Update the renderAccountSelect function
  const renderAccountSelect = () => (
    <div className="space-y-2">
      <Label htmlFor="account">Account</Label>
      <Select
        disabled={disabledFields.account ?? isReadOnly}
        value={selectedAccountId}
        onValueChange={setSelectedAccountId}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select account">
            {accounts[selectedAccountId]?.name || 'Select account'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(accounts).map(([key, value]) => (
            <SelectItem key={key} value={key}>
              <span className="text-sm">{value.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const sanitizeFileName = (fileName: string) => {
    // Replace spaces with underscores and remove other non-alphanumeric characters
    return fileName.replace(/\s+/g, '_').replace(/[^\w.-]+/g, '');
  };

  const uploadFilesToStorage = async (attachments: (File | string)[]) => {
    const uploadedFileNames = [];

    try {
      for (const attachment of attachments) {
        // Skip if attachment is already a filename string
        if (typeof attachment === 'string') {
          uploadedFileNames.push(attachment);
          continue;
        }

        const file = attachment;
        const sanitizedFileName = sanitizeFileName(file.name);
        const filePath = `${transaction!.id}/${sanitizedFileName}`;

        const { error } = await supabase.storage
          .from('fin_account_transaction_attachments')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) {
          console.error('Error uploading file:', error.message);
          throw error;
        }

        // Store just the filePath instead of full URL
        uploadedFileNames.push(filePath);
      }

      return uploadedFileNames;
    } catch (error: unknown) {
      console.error(
        'Error during file upload:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      return [];
    }
  };

  const saveTransaction = async () => {
    setIsSaving(true);
    console.log('attachments', attachments);

    try {
      // Upload files and get the file names
      const attachmentNames = await uploadFilesToStorage(attachments);

      // Send request to save the transaction
      const response = await fetch('/api/budget/transactions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction_id: transaction?.id,
          category_id: selectedCategory?.id,
          merchant_name: merchantName,
          notes: notes,
          tags: selectedTags,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        console.log('Transaction updated successfully:', result.message);
        refreshTrigger();
      } else {
        console.error('Error updating transaction:', result.error);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setAttachments([...attachments, ...Array.from(event.target.files)]);
    }
  };

  // Update the deleteFromStorage function
  const deleteFromStorage = async (filePath: string) => {
    try {
      const { error } = await supabase.storage
        .from('fin_account_transaction_attachments')
        .remove([filePath]);

      if (error) {
        console.error('Error deleting file:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  };

  // Update the removeAttachment function
  const removeAttachment = async (index: number) => {
    const attachment = attachments[index];

    if (typeof attachment === 'string') {
      // It's a URL, delete from storage
      await deleteFromStorage(attachment);
    }

    // Always update the attachments state, regardless of deletion success
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Update the getFileNameFromUrl function
  const getFileNameFromUrl = (filePath: string) => {
    try {
      const pathParts = filePath.split('/');
      return decodeURIComponent(pathParts[pathParts.length - 1] ?? '');
    } catch (error: unknown) {
      console.error('Error extracting filename:', error);
      return '';
    }
  };

  // Update the downloadAttachment function
  const downloadAttachment = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('fin_account_transaction_attachments')
        .download(filePath);

      if (error) {
        throw error;
      }

      // Create download link
      const blob = data;
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = getFileNameFromUrl(filePath);

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const createNewTag = async (tagName: string) => {
    try {
      const { data: newTag, error: createError } = await supabase.rpc(
        'create_budget_tag',
        {
          p_budget_id: budgetId,
          p_tag_name: tagName,
        },
      );

      if (createError) throw createError;

      const tagObject: FinAccountTransactionBudgetTag = {
        id: newTag.id,
        name: newTag.name,
      };

      setTags((prev) => [...prev, tagObject]);
      setSelectedTags((prev) => [...prev, tagObject]);
      setTagSearchQuery('');
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:w-[540px]">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>
              {isReadOnly ? 'View Transaction' : 'Edit Transaction'}
            </SheetTitle>
          </div>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full justify-start text-left font-normal ${isReadOnly || disabledFields.date
                      ? 'cursor-not-allowed opacity-50'
                      : ''
                    }`}
                  disabled={disabledFields.date ?? isReadOnly}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PP') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  disabled={isReadOnly}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category*</Label>
            <Select
              value={selectedCategory?.name ?? ''}
              onValueChange={(value) => {
                // Find the selected category by its name
                const selected = categoryGroups
                  .flatMap((group) => group.categories) // Flatten the category arrays
                  .find((category) => category.name === value); // Find the category by name

                if (selected) {
                  console.log('Selected category:', selected);
                  // Store both name and id of the selected category
                  setSelectedCategory({ name: selected.name, id: selected.id });
                }
              }}
              disabled={disabledFields.category ?? isReadOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search categories..."
                  className="mb-2"
                />
                {categoryGroups.map((group) => (
                  <SelectGroup key={group.id} className="mb-4">
                    <div className="mb-2 text-lg font-semibold">
                      {group.name}
                    </div>
                    <div className="space-y-1 pl-4">
                      {group.categories
                        .filter((category) =>
                          category.name
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase()),
                        )
                        .map((category) => (
                          <SelectItem
                            key={category.id}
                            value={category.name}
                            className="pl-6 hover:text-black"
                          >
                            {category.name}
                          </SelectItem>
                        ))}
                    </div>
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="merchant">Merchant Name</Label>
            <Input
              id="merchant"
              placeholder="Enter merchant name"
              disabled={disabledFields.payee ?? isReadOnly}
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Enter notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={disabledFields.notes ?? isReadOnly}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Select
              value={selectedTags.map(tag => tag.id).join(',')}
              onValueChange={(value: string) => {
                const selectedTag = tags.find(tag => tag.id === value);
                if (selectedTag) {
                  if (selectedTags.some(t => t.id === selectedTag.id)) {
                    setSelectedTags(prev => prev.filter(tag => tag.id !== selectedTag.id));
                  } else {
                    setSelectedTags(prev => [...prev, selectedTag]);
                  }
                }
              }}
            >
              <SelectTrigger className="h-auto min-h-[2.5rem]">
                <SelectValue placeholder="Select tags">
                  <div className="flex flex-wrap gap-1">
                    {selectedTags.length > 0
                      ? selectedTags.map((tag) => (
                          <span
                            key={tag.id}
                            className="cursor-pointer rounded-md bg-secondary px-2 py-0.5 text-sm text-secondary-foreground hover:bg-secondary/80"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTags((prev) =>
                                prev.filter((t) => t.id !== tag.id),
                              );
                            }}
                          >
                            {tag.name}
                          </span>
                        ))
                      : 'Select tags'}
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <Input
                  value={tagSearchQuery}
                  onChange={(e) => setTagSearchQuery(e.target.value)}
                  placeholder="Search or create tags..."
                  className="mb-2"
                />
                {tags
                  .filter(
                    (tag) =>
                      !selectedTags.some(st => st.id === tag.id) &&
                      tag.name
                        .toLowerCase()
                        .includes(tagSearchQuery.toLowerCase()),
                  )
                  .map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      {tag.name}
                    </SelectItem>
                  ))}
                {selectedTags.map((tag) => (
                  <SelectItem
                    key={tag.id}
                    value={tag.id}
                    className="bg-accent"
                  >
                    {tag.name}
                  </SelectItem>
                ))}
                {tagSearchQuery &&
                  !tags.some(
                    (tag) =>
                      tag.name.toLowerCase() === tagSearchQuery.toLowerCase(),
                  ) &&
                  !selectedTags.some(st => st.id === tagSearchQuery) && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start px-2 py-1.5 text-sm"
                      onClick={() => createNewTag(tagSearchQuery)}
                    >
                      Create tag &quot;{tagSearchQuery}&quot;
                    </Button>
                  )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              placeholder="0.00"
              className="text-right"
              disabled={disabledFields.amount ?? isReadOnly}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="recurring"
              checked={isRecurring}
              onCheckedChange={(checked: boolean) => setIsRecurring(checked)}
              disabled={disabledFields.recurring ?? isReadOnly}
            />
            <Label htmlFor="recurring">Recurring Transaction</Label>
          </div>

          {isRecurring && (
            <>
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endAfter">End After</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select end date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never</SelectItem>
                    <SelectItem value="occurrences">
                      After occurrences
                    </SelectItem>
                    <SelectItem value="date">On date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {renderAccountSelect()}

          <div className="space-y-2">
            <Label>Attachment</Label>
            <div className="rounded-lg border-2 border-dashed p-6 text-center">
              {attachments.length > 0 ? (
                <div className="space-y-2">
                  {attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded bg-muted p-2"
                    >
                      {attachment instanceof File ? (
                        <span className="truncate text-sm">
                          {attachment.name}
                        </span>
                      ) : (
                        <button
                          onClick={() => downloadAttachment(attachment)}
                          className="truncate text-left text-sm hover:underline"
                        >
                          {getFileNameFromUrl(attachment)}
                        </button>
                      )}
                      {!isReadOnly && !disabledFields.attachments && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAttachment(index)}
                          className="text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <div className="text-sm text-muted-foreground">
                    Drag file(s) here to upload or
                  </div>
                </>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                multiple
                disabled={disabledFields.attachments ?? isReadOnly}
              />
              <Button
                variant="outline"
                className="mt-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabledFields.attachments ?? isReadOnly}
              >
                Select files
              </Button>
            </div>
          </div>

          <div className="flex flex-col justify-end gap-4 pt-4 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              {isReadOnly ? 'Close' : 'Cancel'}
            </Button>
            {isSaving ? (
              <div className="relative z-10 mt-1">
                <GlobalLoader />
              </div>
            ) : (
              <Button
                variant="default"
                onClick={saveTransaction}
                disabled={isSaving}
                className="w-full sm:w-auto"
              >
                Save
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
