'use client';

import React, { useEffect, useState, useRef, ChangeEvent } from 'react';
import { format } from 'date-fns';
import { Calendar, Upload, X } from 'lucide-react';
import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';
import { Button } from '@kit/ui/button';
import { Calendar as CalendarComponent } from '@kit/ui/calendar';
import { Checkbox } from '@kit/ui/checkbox';
import { GlobalLoader } from '@kit/ui/global-loader';
import { Input } from '@kit/ui/input';
import { Textarea } from '@kit/ui/textarea';
import { Label } from '@kit/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@kit/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@kit/ui/sheet';
import { Category, CategoryGroup, FinAccountTransaction, FinAccountTransactionBudgetTag } from '~/lib/model/fin.types';
import { CategorySelect } from './category-select';
import { TransactionTagSelect } from './transaction-tag-select';
import { useBudgetWorkspace } from '~/components/budget-workspace-context';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

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
  selectedTransaction: FinAccountTransaction;
  isReadOnly?: boolean;
  disabledFields?: DisabledFields;
}

// Update the schema definition
const transactionFormSchema = z.object({
  date: z.date({
    required_error: "Date is required",
  }),
  categoryId: z.string().min(1, 'Category is required'),
  merchantName: z.string().min(1, 'Merchant name is required').optional(),
  notes: z.string().optional(),
  amount: z.string()
    .min(1, 'Amount is required')
    .refine((val) => !isNaN(parseFloat(val)), "Must be a valid number"),
  budgetFinAccountId: z.string().min(1, 'Account is required'),
  tags: z.array(z.object({
    id: z.string(),
    name: z.string()
  })).default([]),
  attachments: z.array(z.union([z.instanceof(File), z.string()])).default([])
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

// Add this helper function to get currency symbol
const getCurrencySymbol = (currencyCode: string): string => {
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'symbol',
    })
      .formatToParts(0)
      .find(part => part.type === 'currency')?.value || '$';
  } catch (e) {
    return '$'; // Fallback if invalid currency code
  }
};

export function TransactionPanel(props: TransactionPanelProps) {
  const { workspace, updateTransaction } = useBudgetWorkspace();
  const supabase = getSupabaseBrowserClient();

  // Update the form initialization
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      date: parseDate(props.selectedTransaction.date),
      categoryId: props.selectedTransaction.svendCategoryId ?? '',
      merchantName: props.selectedTransaction.merchantName ?? '',
      amount: props.selectedTransaction.amount.toFixed(2),
      notes: props.selectedTransaction.notes ?? '',
      budgetFinAccountId: props.selectedTransaction.budgetFinAccountId ?? '',
      tags: props.selectedTransaction.budgetTags ?? [],
      attachments: props.selectedTransaction.budgetAttachmentsStorageNames ?? [],
    }
  });

  const { handleSubmit, watch, setValue, register, formState: { errors } } = form;

  const onSubmit = async (data: TransactionFormValues) => {
    setIsSaving(true);
    const attachmentNames = await uploadFilesToStorage(data.attachments);

    const updatedTransaction = {
      ...props.selectedTransaction,
      date: format(data.date, 'yyyy-MM-dd'),
      svendCategoryId: data.categoryId,
      merchantName: data.merchantName,
      notes: data.notes,
      amount: parseFloat(data.amount),
      budgetFinAccountId: data.budgetFinAccountId,
      budgetTags: data.tags,
      budgetAttachmentsStorageNames: attachmentNames,
    } as FinAccountTransaction;

    try {
      const response = await fetch(`/api/budgets/${workspace.budget.id}/transactions/${updatedTransaction.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction_id: updatedTransaction?.id,
          category_id: updatedTransaction?.svendCategoryId,
          merchant_name: updatedTransaction?.merchantName,
          notes: updatedTransaction?.notes,
          tags: updatedTransaction?.budgetTags,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save transaction');
      }

      // update the transaction in the workspace
      updateTransaction(updatedTransaction);
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const [isRecurring, setIsRecurring] = useState(false);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [attachments, setAttachments] = useState<(File | string)[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | undefined>();
  const [tags, setTags] = useState<FinAccountTransactionBudgetTag[]>([]);

  useEffect(() => {
    console.log('initial transaction: ', props.selectedTransaction);
  }, []);

  useEffect(() => {
    setCategoryGroups(Object.values(workspace?.budgetCategories ?? {}));

    // Find and set the initial category
    const matchingCategoryGroup = Object.values(workspace?.budgetCategories ?? {}).find((group) =>
      group.categories?.some(
        (category) => category?.name === props.selectedTransaction?.svendCategory,
      ),
    );
    const matchingCategory = matchingCategoryGroup?.categories?.find(
      (category) => category.name === props.selectedTransaction?.svendCategory,
    );
    if (matchingCategory) {
      setSelectedCategory({
        id: matchingCategory.id,
        name: matchingCategory.name,
        createdAt: matchingCategory.createdAt,
        updatedAt: matchingCategory.updatedAt,
      });

      // Update the form value
      setValue('categoryId', matchingCategory.id);
    }

    // Only set attachments if they exist, otherwise set empty array
    setAttachments(props.selectedTransaction.budgetAttachmentsStorageNames ?? []);
  }, [workspace?.budgetCategories]);

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
    if (props.selectedTransaction?.budgetFinAccountId) {
      setSelectedAccountId(props.selectedTransaction.budgetFinAccountId);
    }
  }, [workspace?.budget?.linkedFinAccounts, props.selectedTransaction]);

  // Update the renderAccountSelect function
  const renderAccountSelect = () => (
    <div className="space-y-2">
      <Label htmlFor="account">Account<span className="text-destructive">*</span></Label>
      <Select
        disabled={props.disabledFields?.account ?? props.isReadOnly}
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
        const filePath = `budget/${workspace?.budget?.id}/transaction/${props.selectedTransaction!.id}/${sanitizedFileName}`;

        const { error } = await supabase.storage
          .from('budget_transaction_attachments')
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

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
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

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:w-[540px]">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>
              {props.isReadOnly ? 'View Transaction' : 'Edit Transaction'}
            </SheetTitle>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-6">
          {/* Basic Transaction Details */}
          <div className="space-y-2">
            <Label htmlFor="date">Date<span className="text-destructive">*</span></Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full justify-start text-left font-normal`}
                  disabled={props.disabledFields?.date ?? props.isReadOnly}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {watch('date') ? format(watch('date'), 'PP') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={watch('date')}
                  onSelect={(date) => date && setValue('date', date)}
                  initialFocus
                  disabled={props.isReadOnly}
                />
              </PopoverContent>
            </Popover>
            {errors.date && (
              <span className="text-sm text-destructive">{errors.date.message}</span>
            )}
          </div>

          {/* Financial Details */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount<span className="text-destructive">*</span></Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {props.selectedTransaction.isoCurrencyCode
                  ? getCurrencySymbol(props.selectedTransaction.isoCurrencyCode)
                  : '$'}
              </span>
              <Input
                id="amount"
                type="text"
                placeholder="0.00"
                className="pl-8"
                disabled={props.disabledFields?.amount ?? props.isReadOnly}
                {...register('amount')}
              />
            </div>
            {errors.amount && (
              <span className="text-sm text-destructive">{errors.amount.message}</span>
            )}
          </div>

          {renderAccountSelect()}
          {errors.budgetFinAccountId && (
            <span className="text-sm text-destructive">{errors.budgetFinAccountId.message}</span>
          )}

          {/* Categorization */}
          <div className="space-y-2">
            <Label htmlFor="category">Category<span className="text-destructive">*</span></Label>
            <CategorySelect
              value={selectedCategory?.id}
              onValueChange={(value) => {
                const selected = categoryGroups
                  .flatMap((group) => group.categories)
                  .find((category) => category.id === value);

                if (selected) {
                  setSelectedCategory({
                    name: selected.name,
                    id: selected.id,
                    createdAt: selected.createdAt,
                    updatedAt: selected.updatedAt,
                  });

                  // Update the form value
                  setValue('categoryId', selected.id);
                }
              }}
              categoryGroups={categoryGroups}
              disabled={props.disabledFields?.category ?? props.isReadOnly}
            />
            {errors.categoryId && (
              <span className="text-sm text-destructive">{errors.categoryId.message}</span>
            )}
          </div>

          {/* Transaction Description */}
          <div className="space-y-2">
            <Label htmlFor="merchantName">Merchant Name</Label>
            <Input
              {...register('merchantName')}
              disabled={props.disabledFields?.payee ?? props.isReadOnly}
            />
            {errors.merchantName && (
              <span className="text-sm text-destructive">{errors.merchantName.message}</span>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Enter notes"
              {...register('notes')}
              disabled={props.disabledFields?.notes ?? props.isReadOnly}
            />
          </div>

          {/* Organization & Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <TransactionTagSelect
              transactionId={props.selectedTransaction.id}
              onTagsChange={(newTags: FinAccountTransactionBudgetTag[]) => {
                setValue('tags', newTags, {
                  shouldValidate: true,
                  shouldDirty: true,
                  shouldTouch: true
                });
              }}
              disabled={props.isReadOnly}
            />
          </div>

          {/* Recurring Settings */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="recurring"
              checked={false}
              disabled={true}
            />
            <Label htmlFor="recurring">Recurring Transaction</Label>
          </div>

          {isRecurring && (
            <>
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency (Disabled)</Label>
                <Select disabled value="monthly">
                  <SelectTrigger>
                    <SelectValue>Monthly</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endAfter">End After (Disabled)</Label>
                <Select disabled value="never">
                  <SelectTrigger>
                    <SelectValue>Never</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Attachments & Documents */}
          <div className="space-y-2">
            <Label>Attachments</Label>
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
                      {!props.isReadOnly && !props.disabledFields?.attachments && (
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
                disabled={props.disabledFields?.attachments ?? props.isReadOnly}
              />
              <Button
                variant="outline"
                className="mt-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={props.disabledFields?.attachments ?? props.isReadOnly}
              >
                Select files
              </Button>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-col justify-end gap-4 pt-4 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => props.onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              {props.isReadOnly ? 'Close' : 'Cancel'}
            </Button>
            {isSaving ? (
              <GlobalLoader />
            ) : (
              <Button
                type="submit"
                variant="default"
                disabled={isSaving}
                className="w-full sm:w-auto"
              >
                Save
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// Private function to parse date
const parseDate = (dateString: string): Date => {
  const date = new Date();
  date.setFullYear(Number(dateString.split('-')[0]));
  date.setMonth(Number(dateString.split('-')[1]) - 1);
  date.setDate(Number(dateString.split('-')[2]));
  return date;
};
