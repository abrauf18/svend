'use client';
import React, { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';
import { Button } from '@kit/ui/button';
import { GlobalLoader } from '@kit/ui/global-loader';
import { Textarea } from '@kit/ui/textarea';
import { Label } from '@kit/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@kit/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@kit/ui/sheet';
import { Category, CategoryGroup } from '~/lib/model/fin.types';
import { BudgetFinAccountRecurringTransaction, BudgetFinAccountTransactionTag } from '~/lib/model/budget.types';
import { TransactionTagSelect } from '../../transaction-tag-select';
import { useBudgetWorkspace } from '~/components/budget-workspace-context';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { TransactionCategorySelect } from '../../transaction-category-select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@kit/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@kit/ui/table';

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

interface RecurringPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTransaction: BudgetFinAccountRecurringTransaction;
  isReadOnly?: boolean;
  disabledFields?: DisabledFields;
}

// Update the schema definition
const transactionFormSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  notes: z.string().optional(),
  budgetFinAccountId: z.string().min(1, 'Account is required'),
  tags: z.array(z.object({
    id: z.string(),
    name: z.string()
  })).default([])
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

export function RecurringPanel(props: RecurringPanelProps) {
  const { workspace, updateRecurringTransaction } = useBudgetWorkspace();
  const supabase = getSupabaseBrowserClient();

  // Update the form initialization
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      budgetFinAccountId: props.selectedTransaction.budgetFinAccountId ?? '',
      categoryId: props.selectedTransaction.categoryId ?? '',
      notes: props.selectedTransaction.notes ?? '',
      tags: props.selectedTransaction.budgetTags ?? []
    }
  });

  const { handleSubmit, watch, setValue, register, formState: { errors } } = form;

  const onSubmit = async (data: TransactionFormValues) => {
    setIsSaving(true);

    try {
      const updatedTransaction = {
        ...props.selectedTransaction,
        budgetFinAccountId: data.budgetFinAccountId,
        categoryId: data.categoryId,
        notes: data.notes,
        budgetTags: data.tags,
      } as BudgetFinAccountRecurringTransaction;
      const response = await fetch(`/api/budgets/${workspace.budget.id}/transactions-recurring/${updatedTransaction.transaction.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categoryId: updatedTransaction?.categoryId,
          notes: updatedTransaction?.notes,
          tags: updatedTransaction?.budgetTags,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save transaction');
      }

      updateRecurringTransaction(updatedTransaction);
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
  const [selectedCategory, setSelectedCategory] = useState<Category | undefined>();

  useEffect(() => {
    console.log('transaction panel > initial transaction: ', props.selectedTransaction);
  }, []);

  useEffect(() => {
    setCategoryGroups(Object.values(workspace?.budgetCategories ?? {}));

    // Find and set the initial category
    const matchingCategoryGroup = Object.values(workspace?.budgetCategories ?? {}).find((group) =>
      group.categories?.some(
        (category) => category?.name === props.selectedTransaction?.category,
      ),
    );
    const matchingCategory = matchingCategoryGroup?.categories?.find(
      (category) => category.name === props.selectedTransaction?.category,
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

  // Add new state for associated transactions
  const [associatedTransactions, setAssociatedTransactions] = useState<any[]>([]);

  // Add useEffect to filter and set associated transactions
  useEffect(() => {
    const transactions = workspace?.budgetTransactions
      ?.filter(t => props.selectedTransaction.transaction.finAccountTransactionIds?.includes(t.transaction.id))
      .sort((a, b) => {
        const dateA = new Date(a.transaction.date);
        const dateB = new Date(b.transaction.date);
        return dateB.getTime() - dateA.getTime();
      }) ?? [];
    
    setAssociatedTransactions(transactions);
  }, [workspace?.budgetTransactions, props.selectedTransaction]);

  // Add this helper function at the component level
  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year!, month! - 1, day!);
    return date.toLocaleDateString(navigator.language, {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className="flex h-[100dvh] w-full flex-col sm:w-[540px] p-0">
        {/* Add loader overlay */}
        {isSaving && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-50">
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
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4 max-h-[calc(100dvh-10rem)]">
            {/* Transaction Dates */}
            <div className="space-y-4">
              {/* Latest Transaction Date */}
              <div className="space-y-2">
                <Label>Latest Transaction</Label>
                <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                  {associatedTransactions.length > 0 ? (
                    formatDate(associatedTransactions[0].transaction.date)
                  ) : (
                    <span>No transactions yet</span>
                  )}
                </div>
              </div>

              {/* Next Expected Date */}
              <div className="space-y-2">
                <Label>Next Expected Transaction</Label>
                <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                  {props.selectedTransaction.transaction.plaidRawData?.predicted_next_date ? (
                    formatDate(props.selectedTransaction.transaction.plaidRawData.predicted_next_date)
                  ) : (
                    <span>Not available</span>
                  )}
                </div>
              </div>
            </div>

            {/* Associated Transactions */}
            <div className="space-y-2">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="transactions">
                  <AccordionTrigger className="text-sm">
                    {associatedTransactions.length} Associated Transactions
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="rounded-md border mt-2 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[120px]">Date</TableHead>
                            <TableHead className="text-right min-w-[100px]">Amount</TableHead>
                            <TableHead className="min-w-[140px]">Category</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {associatedTransactions.map((transaction) => (
                            <TableRow key={transaction.transaction.id}>
                              <TableCell className="whitespace-nowrap">
                                {formatDate(transaction.transaction.date)}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                {new Intl.NumberFormat('en-US', {
                                  style: 'currency',
                                  currency: transaction.transaction.isoCurrencyCode || 'USD',
                                }).format(transaction.transaction.amount)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {transaction.category}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Account Select */}
            {renderAccountSelect()}
            {errors.budgetFinAccountId && (
              <span className="text-sm text-destructive">{errors.budgetFinAccountId.message}</span>
            )}

            {/* Categorization */}
            <div className="space-y-2">
              <Label htmlFor="category">Category<span className="text-destructive">*</span></Label>
              <TransactionCategorySelect
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
                transactionId={props.selectedTransaction.transaction.id}
                onTagsChange={(newTags: BudgetFinAccountTransactionTag[]) => {
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
          </div>

          <div className="sticky bottom-0 flex shrink-0 border-t bg-background p-4">
            <div className="flex w-full flex-col sm:flex-row sm:justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => props.onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                {props.isReadOnly ? 'Close' : 'Cancel'}
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={isSaving}
                className="w-full sm:w-auto"
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

