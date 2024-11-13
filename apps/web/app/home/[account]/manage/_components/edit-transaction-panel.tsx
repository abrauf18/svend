'use client';

import * as React from 'react';


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

interface Transaction {
  id: string;
  category?: string;
  merchant_name?: string;
  notes?: string;
  amount: number;
  date: Date;
  attachments_storage_names?: string[];
}

interface TransactionPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction;
  selectedRowData?: Transaction;
  isReadOnly?: boolean;
  disabledFields?: DisabledFields;
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

export function TransactionPanel({
  open,
  onOpenChange,
  transaction,
  selectedRowData,
  isReadOnly = false,
  disabledFields = {},
}: TransactionPanelProps) {
  const [date, setDate] = React.useState<Date>();
  const [isRecurring, setIsRecurring] = React.useState(false);
  const [categoryGroups, setCategoryGroups] = React.useState<CategoryGroup[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [payeeName, setPayeeName] = React.useState(''); // New state for payee name
  const [amount, setAmount] = React.useState(0);
  const [notes, setNotes] = React.useState('');
  const [attachments, setAttachments] = React.useState<(File | string)[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (selectedRowData) {
      setDate(selectedRowData.date);
      setPayeeName(selectedRowData.merchant_name ?? '');
      setAmount(selectedRowData.amount);
      setNotes(selectedRowData.notes ?? '');
      console.log('selectedRowData in useEffect', selectedRowData);

      // Find matching category in nested categories
      if (categoryGroups.length > 0) {
        const matchingCategoryGroup = categoryGroups?.find((group) =>
          group.categories?.some(
            (category) => category?.name === selectedRowData?.category,
          ),
        );
        const matchingCategory = matchingCategoryGroup?.categories?.find(
          (category) => category.name === selectedRowData?.category,
        );
        setSelectedCategory(matchingCategory);
        
        // Only set attachments if they exist, otherwise set empty array
        setAttachments(selectedRowData.attachments_storage_names ?? []);
      }
    }
  }, [selectedRowData, categoryGroups]);

  const [selectedCategory, setSelectedCategory] = React.useState<Category | undefined>();
  const supabase = getSupabaseBrowserClient();

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
      console.error('Error during file upload:', error instanceof Error ? error.message : 'Unknown error');
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
          new_category: selectedCategory?.name,
          merchant_name: payeeName,
          notes: notes,
          category_id: selectedCategory?.id,
          attachments: attachmentNames,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        console.log(
          'Transaction category updated successfully:',
          result.message,
        );
      } else {
        console.error('Error updating transaction category:', result.error);
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
    setAttachments(prev => prev.filter((_, i) => i !== index));
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[540px] overflow-y-auto">
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
                  className={`w-full justify-start text-left font-normal ${
                    isReadOnly || disabledFields.date
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
            <Label htmlFor="payee">Payee</Label>
            <Input
              id="payee"
              placeholder="Enter payee name"
              disabled={disabledFields.payee ?? isReadOnly}
              value={payeeName}
              onChange={(e) => setPayeeName(e.target.value)}
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

          <div className="space-y-2">
            <Label htmlFor="account">Account</Label>
            <Select disabled={disabledFields.account ?? isReadOnly}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="account1">Account 1</SelectItem>
                <SelectItem value="account2">Account 2</SelectItem>
              </SelectContent>
            </Select>
          </div>

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

          <div className="flex flex-col sm:flex-row justify-end gap-4 pt-4">
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
