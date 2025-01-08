'use client';

import React, { useEffect, useState, ChangeEvent } from 'react';
import { format } from 'date-fns';
import { Calendar, Upload, X } from 'lucide-react';
import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';
import { Button } from '@kit/ui/button';
import { Calendar as CalendarComponent } from '@kit/ui/calendar';
import { GlobalLoader } from '@kit/ui/global-loader';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@kit/ui/sheet';
import { Category, CategoryGroup } from '~/lib/model/fin.types';
import { BudgetFinAccountTransaction, BudgetFinAccountTransactionTag } from '~/lib/model/budget.types';
import { TransactionTagSelect } from '../_shared/transaction-tag-select';
import { useBudgetWorkspace } from '~/components/budget-workspace-context';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { TransactionCategorySelect } from '../_shared/transaction-category-select';
import { ResizableTextarea } from '@kit/ui/resizable-textarea';
import { Switch } from '@kit/ui/switch';
import { sanitizeFileName } from '~/utils/sanitize-filename';
import { getUniqueFileName } from '~/utils/get-unique-filename';
import { getFileNameFromUrl } from '~/utils/get-filename-from-url';
import { toast } from 'sonner';

interface DisabledFields {
  userTxId?: boolean;
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
  selectedTransaction: BudgetFinAccountTransaction;
  isReadOnly?: boolean;
  disabledFields?: DisabledFields;
}

// Update the schema definition
const transactionFormSchema = z.object({
  date: z.date({
    required_error: 'Date is required',
  }),
  categoryId: z.string().superRefine((val, ctx) => {
    const isSplit = (ctx as any)._parent?.data?.isSplit;
    if (!isSplit && !val) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Category or split is required"
      });
      return false;
    }
    return true;
  }),
  merchantName: z.string().optional(),
  notes: z.string().optional(),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((val) => !isNaN(parseFloat(val)), 'Must be a valid number'),
  budgetFinAccountId: z.string().min(1, 'Account is required'),
  tags: z.array(z.object({
    id: z.string(),
    name: z.string()
  })).default([]),
  attachments: z.array(z.union([z.instanceof(File), z.string()])).default([]),
  isSplit: z.boolean().default(false),
  splitComponents: z.array(z.object({
    categoryId: z.string(),
    weight: z.number()
  }))
  .default([])
  .superRefine((components, ctx) => {
    // Only validate if split mode is enabled
    const isSplit = (ctx as any)._parent?.data?.isSplit;
    if (!isSplit) return true;

    // Require at least 2 components when in split mode
    if (components.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Split mode requires at least 2 components"
      });
      return false;
    }

    // Validate that all components have categories selected
    if (components.some(comp => !comp.categoryId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "All split components must have a category selected"
      });
      return false;
    }

    // Validate that all weights are positive numbers
    if (components.some(comp => comp.weight <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "All categories must have a weight greater than 0%"
      });
      return false;
    }

    // Validate that weights sum to 100%
    const total = components.reduce((sum, comp) => sum + comp.weight, 0);
    if (Math.abs(total - 100) > 0.01) { // Using small epsilon for floating point comparison
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Total distribution must equal 100%"
      });
      return false;
    }

    return true;
  }),
  userTxId: z.string()
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

export function TransactionPanel(props: TransactionPanelProps) {
  const { workspace, updateTransaction, updateBudgetSpending } = useBudgetWorkspace();
  const supabase = getSupabaseBrowserClient();
  const isOneOffSplit = props.selectedTransaction.category?.id === props.selectedTransaction.category?.name && 
                      props.selectedTransaction.categoryGroup === workspace?.budget?.id;
  const [isSplitMode, setIsSplitMode] = useState(isOneOffSplit);
  const budgetId = workspace?.budget?.id;
  // Add this state to track the current storage files
  const [currentStorageFiles, setCurrentStorageFiles] = useState<string[]>(
    props.selectedTransaction.budgetAttachmentsStorageNames ?? [],
  );

  // Update the form initialization
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      userTxId: props.selectedTransaction.transaction.userTxId ?? '',
      date: parseDate(props.selectedTransaction.transaction.date),
      amount: props.selectedTransaction.transaction.amount.toFixed(2),
      budgetFinAccountId: props.selectedTransaction.budgetFinAccountId ?? '',
      categoryId: props.selectedTransaction.category?.id ?? '',
      merchantName: props.selectedTransaction.merchantName ?? '',
      notes: props.selectedTransaction.notes ?? '',
      tags: props.selectedTransaction.budgetTags ?? [],
      attachments: props.selectedTransaction.budgetAttachmentsStorageNames ?? [],
      // Check for either type of split category
      isSplit: isOneOffSplit,
      // Initialize with 2 empty rows if no composite data exists
      splitComponents: isOneOffSplit && props.selectedTransaction.category?.compositeData?.length 
        ? props.selectedTransaction.category.compositeData 
        : [
            { categoryId: '', weight: 0 },
            { categoryId: '', weight: 0 }
          ],
    },
    mode: 'onSubmit',
  });

  // Add this useEffect to debug the value
  useEffect(() => {
    console.log('Transaction ID:', props.selectedTransaction.transaction.userTxId);
    console.log('Form Values:', form.getValues());
  }, [props.selectedTransaction]);

  const { handleSubmit, watch, setValue, register, formState: { errors }, control } = form;

  const onSubmit = async (data: TransactionFormValues) => {
    setIsSaving(true);

    try {
      // Validate composite data first
      if (data.isSplit) {
        const hasInvalidComponents = !data.splitComponents || 
          data.splitComponents.length < 2 || 
          data.splitComponents.some(comp => !comp.categoryId) ||
          Math.abs(data.splitComponents.reduce((sum, comp) => sum + comp.weight, 0) - 100) > 0.01;

        if (hasInvalidComponents) {
          toast.error('Split transactions must have at least 2 categories and weights must total 100%', {
            duration: 3000,
            position: 'bottom-center',
          });
          return;
        }
      }

      let categoryId;
      let categoryName;
      let categoryGroupId;
      let categoryGroupName;

      if (data.isSplit) {
        categoryGroupId = workspace?.budget?.id;
        categoryGroupName = workspace?.budget?.id;
        // We'll update these after the API response
        categoryId = undefined;
        categoryName = undefined;
      } else {
        const allCategories = Object.values(workspace?.budgetCategories ?? {}).flatMap(
          (group) => group.categories
        );
        const selectedCategory = allCategories.find((cat) => cat.id === data.categoryId);
        const selectedGroup = Object.values(workspace?.budgetCategories ?? {}).find((group) =>
          group.categories.some((cat) => cat.id === data.categoryId)
        );
        categoryId = selectedCategory?.id;
        categoryName = selectedCategory?.name;
        categoryGroupId = selectedGroup?.id;
        categoryGroupName = selectedGroup?.name;
      }

      // Compare current attachments with initial storage files
      const { toUpload, toKeep, toDelete } = compareAttachments(
        data.attachments,
        currentStorageFiles,
      );

      // Delete removed files from storage
      if (toDelete.length > 0) {
        for (const filePath of toDelete) {
          await deleteFromStorage(filePath);
        }
      }

      // Upload new files
      const uploadedFiles = await uploadFilesToStorage(toUpload);

      // Combine kept files with newly uploaded ones
      const finalAttachments = [...toKeep, ...uploadedFiles];

      // Update the current storage files
      setCurrentStorageFiles(finalAttachments);

      const response = await fetch(
        `/api/budgets/${workspace.budget.id}/transactions/${props.selectedTransaction.transaction.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            categoryId: data.isSplit ? undefined : data.categoryId,
            merchantName: data.merchantName,
            notes: data.notes,
            tags: data.tags,
            isSplit: data.isSplit,
            splitComponents: data.isSplit ? data.splitComponents.map(comp => {
              const category = categoryGroups
                .flatMap(g => g.categories)
                .find(c => c.id === comp.categoryId);
              return {
                categoryId: comp.categoryId,
                weight: comp.weight,
                categoryName: category?.name ?? ''
              };
            }) : undefined
          }),
        },
      );

      if (!response.ok) {
        toast.error('Failed to save transaction', {
          duration: 10000,
          position: 'bottom-center',
        });
        return;
      }

      const responseData = await response.json();
      console.log('responseData', responseData);

      if (data.isSplit) {
        // Handle both new and existing split categories
        const splitCategoryId = responseData.newCategoryId || responseData.existingCategoryId;
        if (splitCategoryId) {
          categoryId = splitCategoryId;
          categoryName = splitCategoryId;
        }
      }

      const updatedTransaction = {
        ...props.selectedTransaction,
        transaction: {
          ...props.selectedTransaction.transaction,
          date: format(data.date, 'yyyy-MM-dd'),
          amount: parseFloat(data.amount),
        },
        budgetFinAccountId: data.budgetFinAccountId,
        categoryId: categoryId,
        categoryGroupId: categoryGroupId,
        categoryGroup: categoryGroupName,
        categoryName: categoryName,
        merchantName: data.merchantName,
        notes: data.notes,
        budgetTags: data.tags,
        budgetAttachmentsStorageNames: finalAttachments,
        isComposite: data.isSplit,
        category: {
          ...props.selectedTransaction.category,
          id: categoryId,
          name: categoryName,
          isComposite: data.isSplit,
          compositeData: data.isSplit ? data.splitComponents.map(comp => ({
            categoryId: comp.categoryId,
            weight: comp.weight,
            categoryName: categoryGroups
              .flatMap(g => g.categories)
              .find(c => c.id === comp.categoryId)?.name ?? ''
          })) : undefined
        }
      } as BudgetFinAccountTransaction;

      // update the transaction in the workspace
      updateTransaction(updatedTransaction);

      // update the spending tracking if the category changed
      if (responseData.spendingTracking) {
        updateBudgetSpending(responseData.spendingTracking);
      }
    } catch (error) {
      console.error('Error during submission:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const [isRecurring, setIsRecurring] = useState(false);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<
    Category | undefined
  >();

  useEffect(() => {
    console.log(
      'transaction panel > initial transaction: ',
      props.selectedTransaction,
    );
  }, []);

  useEffect(() => {
    const filteredCategoryGroups = Object.values(workspace?.budgetCategories ?? {}).filter(
      group => group.name !== workspace?.budget?.id
    );
    setCategoryGroups(filteredCategoryGroups);

    // Find and set the initial category
    const matchingCategoryGroup = filteredCategoryGroups.find((group) =>
      group.categories?.some(
        (category) => category?.name === props.selectedTransaction?.category?.name,
      ),
    );
    const matchingCategory = matchingCategoryGroup?.categories?.find(
      (category) => category.name === props.selectedTransaction?.category?.name,
    );
    if (matchingCategory) {
      setSelectedCategory({
        id: matchingCategory.id,
        name: matchingCategory.name,
        createdAt: matchingCategory.createdAt,
        updatedAt: matchingCategory.updatedAt,
        isDiscretionary: matchingCategory.isDiscretionary,
      });

      // Update the form value
      setValue('categoryId', matchingCategory.id);
    }

    // Only set attachments if they exist, otherwise set empty array
    setValue(
      'attachments',
      props.selectedTransaction.budgetAttachmentsStorageNames ?? [],
    );
  }, [workspace?.budgetCategories]);

  const [accounts, setAccounts] = useState<
    Record<string, { name: string; balance: number }>
  >({});
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
      {},
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
      <Label htmlFor="account">
        Account<span className="text-destructive">*</span>
      </Label>
      <Select
        disabled={props.disabledFields?.account ?? props.isReadOnly}
        value={selectedAccountId}
        onValueChange={setSelectedAccountId}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select account">
            {accounts[selectedAccountId]?.name ?? 'Select account'}
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

  // Update the uploadFilesToStorage function to use the sanitized unique name
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
        const filePath = `budget/${workspace?.budget?.id}/transaction/${props.selectedTransaction.transaction.id}/${sanitizedFileName}`;

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

  // Update the handleFileUpload function
  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const currentAttachments = watch('attachments');
      const newFiles = Array.from(event.target.files).map((file) => {
        // Always create a new File with a sanitized name
        const sanitizedName = sanitizeFileName(file.name);
        const uniqueName = getUniqueFileName(sanitizedName, currentAttachments);
        return new File([file], uniqueName, { type: file.type });
      });

      setValue('attachments', [...currentAttachments, ...newFiles]);
    }
  };

  // Update the deleteFromStorage function
  const deleteFromStorage = async (filePath: string) => {
    try {
      const { error } = await supabase.storage
        .from('budget_transaction_attachments')
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

  // Update the downloadAttachment function
  const downloadAttachment = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('budget_transaction_attachments')
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

  // Add this helper function at the top level
  const compareAttachments = (
    currentAttachments: (File | string)[],
    initialStorageFiles: string[],
  ) => {
    // Files that need to be uploaded (new File objects)
    const toUpload = currentAttachments.filter(
      (att) => att instanceof File,
    ) as File[];

    // Existing storage paths we want to keep
    const toKeep = currentAttachments.filter(
      (att) => typeof att === 'string',
    ) as string[];

    // Files that need to be deleted (any initial files not in toKeep)
    const toDelete = initialStorageFiles.filter(
      (file) => !toKeep.includes(file),
    );

    return {
      toUpload,
      toKeep,
      toDelete,
    };
  };
  
  const getCurrencySymbol = (currencyCode: string): string => {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode })
        .formatToParts(0)
        .find(part => part.type === 'currency')?.value ?? '$';
    } catch {
      return '$';
    }
  };

  const handleSplitComponentsChange = React.useCallback((components: Array<{
    categoryId: string;
    weight: number;
  }>) => {
    setValue('splitComponents', components, {
      shouldValidate: false
    });
    console.log('splitComponents', components);
  }, [setValue]);

  useEffect(() => {
    if (props.selectedTransaction) {
      setValue('categoryId', props.selectedTransaction.category?.id || '');
      setValue('merchantName', props.selectedTransaction.merchantName || '');
      setValue('notes', props.selectedTransaction.notes || '');
      setValue('tags', props.selectedTransaction.budgetTags || []);
      
      if (props.selectedTransaction.category?.isComposite) {
        setIsSplitMode(true);
        setValue('isSplit', true);
        // Ensure we have at least 2 rows even if compositeData is empty
        setValue('splitComponents', 
          props.selectedTransaction.category?.compositeData?.length
            ? props.selectedTransaction.category.compositeData.map(comp => ({
                categoryId: comp.categoryId,
                weight: comp.weight
              }))
            : [
                { categoryId: '', weight: 0 },
                { categoryId: '', weight: 0 }
              ]
        );
      }
    }
  }, [props.selectedTransaction, setValue]);

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className="flex h-[100dvh] w-full flex-col p-0 sm:w-[540px]">
        {/* Add loader overlay */}
        {isSaving && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80">
            <GlobalLoader />
          </div>
        )}

        <SheetHeader className="p-6 pb-2">
          <div className="flex items-center justify-between">
            <SheetTitle>
              {props.isReadOnly ? 'View Transaction' : 'Edit Transaction'}
            </SheetTitle>
          </div>
        </SheetHeader>
        <form 
          onSubmit={handleSubmit(onSubmit)} 
          className="flex flex-col flex-1 overflow-hidden"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
              e.preventDefault();
            }
          }}
        >
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4 max-h-[calc(100dvh-10rem)]">
            {/* Transaction ID */}
            <div className="space-y-2">
              <Label htmlFor="userTxId">Transaction ID</Label>
              <Input
                id="userTxId"
                {...register('userTxId')}
                readOnly
                disabled
                value={watch('userTxId')}
                className="bg-muted"
              />
            </div>

            {/* Basic Transaction Details */}
            <div className="space-y-2">
              <Label htmlFor="date">
                Date<span className="text-destructive">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full justify-start text-left font-normal`}
                    disabled={props.disabledFields?.date ?? props.isReadOnly}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {watch('date')
                      ? format(watch('date'), 'PP')
                      : 'Select date'}
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
                <span className="text-sm text-destructive">
                  {errors.date.message}
                </span>
              )}
            </div>

            {/* Financial Details */}
            <div className="space-y-2">
              <Label htmlFor="amount">
                Amount<span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {props.selectedTransaction.transaction.isoCurrencyCode
                    ? getCurrencySymbol(
                        props.selectedTransaction.transaction.isoCurrencyCode,
                      )
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
                <span className="text-sm text-destructive">
                  {errors.amount.message}
                </span>
              )}
            </div>

            {renderAccountSelect()}
            {errors.budgetFinAccountId && (
              <span className="text-sm text-destructive">
                {errors.budgetFinAccountId.message}
              </span>
            )}

            {/* Categorization */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="category">Category<span className="text-destructive">*</span></Label>
                <div className="flex items-center gap-2">
                  <Label>Split</Label>
                  <Switch 
                    checked={isSplitMode}
                    onCheckedChange={(value) => {
                      setIsSplitMode(value);
                      setValue('isSplit', value);
                      if (!value) {
                        // Clear split components when turning off split mode
                        setValue('splitComponents', [], {
                          shouldValidate: true
                        });
                        // Only clear categoryId if it's not already set to a regular category
                        if (!selectedCategory?.id) {
                          setValue('categoryId', '', {
                            shouldValidate: true
                          });
                        }
                      }
                    }}
                  />
                </div>
              </div>
              <TransactionCategorySelect
                value={selectedCategory?.id}
                budgetId={budgetId}
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
                      isDiscretionary: selected.isDiscretionary,
                    });

                    setValue('categoryId', selected.id);
                  }
                }}
                categoryGroups={categoryGroups}
                disabled={props.disabledFields?.category ?? props.isReadOnly}
                isSplitMode={isSplitMode}
                onSplitComponentsChange={handleSplitComponentsChange}
                splitComponents={watch('splitComponents')}
              />
              {errors.categoryId && !isSplitMode && (
                <span className="text-sm text-destructive">
                  {errors.categoryId.message}
                </span>
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
                <span className="text-sm text-destructive">
                  {errors.merchantName.message}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <ResizableTextarea
                id="notes"
                {...register('notes')}
                placeholder="Enter notes"
                disabled={props.disabledFields?.notes ?? props.isReadOnly}
              />
            </div>

            {/* Organization & Tags */}
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <TransactionTagSelect
                transactionId={props.selectedTransaction.transaction.id}
                type="transactions"
                onTagsChange={(newTags: BudgetFinAccountTransactionTag[]) => {
                  setValue('tags', newTags, {
                    shouldValidate: true,
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                }}
                disabled={props.isReadOnly}
              />
            </div>

            {/* Recurring Settings */}
            {/* <div className="flex items-center space-x-2">
              <Checkbox
                id="recurring"
                checked={false}
                disabled={true}
              />
              <Label htmlFor="recurring">Recurring Transaction</Label>
            </div> */}

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
                {watch('attachments').length > 0 ? (
                  <div className="space-y-2">
                    {/* Files list */}
                    <div className="mb-4 space-y-2">
                      {watch('attachments').map((attachment, index) => (
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
                          {!props.isReadOnly &&
                            !props.disabledFields?.attachments && (
                              <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                onClick={() => {
                                  const currentAttachments =
                                    watch('attachments');
                                  setValue(
                                    'attachments',
                                    currentAttachments.filter(
                                      (_, i) => i !== index,
                                    ),
                                  );
                                }}
                                className="text-destructive"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                        </div>
                      ))}
                    </div>

                    {/* Add files button with separator and spacing */}
                    {!props.isReadOnly &&
                      !props.disabledFields?.attachments && (
                        <>
                          <div className="my-2 border-t" />
                          <label className="mt-4 block cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                            <input
                              type="file"
                              onChange={handleFileUpload}
                              className="hidden"
                              multiple
                            />
                            <span className="flex items-center justify-center gap-2">
                              <Upload className="h-4 w-4" />
                              Add more files
                            </span>
                          </label>
                        </>
                      )}
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                    <div className="text-sm text-muted-foreground">
                      <span>Drag file(s) here to upload or </span>
                      <span className="text-primary hover:underline">
                        browse
                      </span>
                    </div>
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      multiple
                      disabled={
                        props.disabledFields?.attachments ?? props.isReadOnly
                      }
                    />
                  </label>
                )}
              </div>
            </div>

          </div>

          <div className="sticky bottom-0 flex shrink-0 border-t bg-background p-4">
            <div className="flex w-full flex-row justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => props.onOpenChange(false)}
                className="flex-1 sm:flex-initial"
              >
                {props.isReadOnly ? 'Close' : 'Cancel'}
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={isSaving}
                className="flex-1 sm:flex-initial"
              >
                Save
              </Button>
            </div>
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
