'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@kit/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@kit/ui/select';
import { Switch } from '@kit/ui/switch';
import { Checkbox } from '@kit/ui/checkbox';
import { CategoryGroup } from '~/lib/model/fin.types';
import { BudgetFinAccountTransactionTag } from '~/lib/model/budget.types';
import { toast } from 'sonner';
import { useBudgetWorkspace } from '~/components/budget-workspace-context';
import { TransactionCategorySelect } from '~/home/[account]/manage/_components/tabs/_shared/transaction-category-select';
import { TransactionTagSelect } from '../../manage/_components/tabs/_shared/transaction-tag-select';

const ruleFormSchema = z.object({
  name: z.string().min(1, 'Rule name is required'),
  criteria: z.object({
    merchantName: z.object({
      enabled: z.boolean(),
      matchType: z.enum(['contains', 'exactly']).default('contains'),
      value: z.string().optional(),
    }),
    amount: z.object({
      enabled: z.boolean(),
      type: z.enum(['expenses', 'income']).optional(),
      matchType: z.enum(['exactly', 'between']).optional().default('exactly'),
      value: z.coerce.string().optional(),
      rangeStart: z.coerce.string().optional(),
      rangeEnd: z.coerce.string().optional(),
    }),
    date: z.object({
      enabled: z.boolean(),
      matchType: z.enum(['between', 'exactly']).optional().default('exactly'),
      value: z.coerce.number().optional(),
      rangeStart: z.coerce.number().optional(),
      rangeEnd: z.coerce.number().optional(),
    }),
    account: z.object({
      enabled: z.boolean(),
      value: z.string().optional(),
    }),
  }),
  actions: z.object({
    renameMerchant: z.object({
      enabled: z.boolean(),
      value: z.string().optional(),
    }),
    setNote: z.object({
      enabled: z.boolean(),
      value: z.string().optional(),
    }),
    setCategory: z.object({
      enabled: z.boolean(),
      value: z.string().optional(),
    }),
    addTags: z.object({
      enabled: z.boolean(),
      value: z.array(z.string()).optional(),
    }),
  }),
  isAppliedToAllTransactions: z.boolean().default(false),
}).superRefine((data, ctx) => {
  if (data.criteria.merchantName.enabled && (!data.criteria.merchantName.value || data.criteria.merchantName.value.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Merchant name is required when enabled",
      path: ["criteria", "merchantName", "value"]
    });
  }

  if (data.criteria.amount.enabled) {
    if (data.criteria.amount.matchType === 'exactly' && (!data.criteria.amount.value || data.criteria.amount.value.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Amount is required when exact match is enabled",
        path: ["criteria", "amount", "value"]
      });
    }
    if (data.criteria.amount.matchType === 'between') {
      if (!data.criteria.amount.rangeStart || data.criteria.amount.rangeStart.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Start amount is required when range is enabled",
          path: ["criteria", "amount", "rangeStart"]
        });
      }
      if (!data.criteria.amount.rangeEnd || data.criteria.amount.rangeEnd.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End amount is required when range is enabled",
          path: ["criteria", "amount", "rangeEnd"]
        });
      }
    }
  }

  if (data.criteria.date.enabled) {
    if (data.criteria.date.matchType === 'exactly' && (!String(data.criteria.date.value) || String(data.criteria.date.value).length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Day is required when exact match is enabled",
        path: ["criteria", "date", "value"]
      });
    }
    if (data.criteria.date.matchType === 'between') {
      if (!data.criteria.date.rangeStart || String(data.criteria.date.rangeStart).length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Start day is required when range is enabled",
          path: ["criteria", "date", "rangeStart"]
        });
      }
      if (!data.criteria.date.rangeEnd || String(data.criteria.date.rangeEnd).length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End day is required when range is enabled",
          path: ["criteria", "date", "rangeEnd"]
        });
      }
    }
  }

  if (data.criteria.account.enabled && (!data.criteria.account.value || data.criteria.account.value.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Account selection is required when enabled",
      path: ["criteria", "account", "value"]
    });
  }

  if (data.actions.renameMerchant.enabled && (!data.actions.renameMerchant.value || data.actions.renameMerchant.value.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "New merchant name is required when enabled",
      path: ["actions", "renameMerchant", "value"]
    });
  }

  if (data.actions.setNote.enabled && (!data.actions.setNote.value || data.actions.setNote.value.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Note is required when enabled",
      path: ["actions", "setNote", "value"]
    });
  }

  if (data.actions.setCategory.enabled && (!data.actions.setCategory.value || data.actions.setCategory.value.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Category selection is required when enabled",
      path: ["actions", "setCategory", "value"]
    });
  }

  if (data.actions.addTags.enabled && (!data.actions.addTags.value || data.actions.addTags.value.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one tag must be selected when enabled",
      path: ["actions", "addTags", "value"]
    });
  }

  if (data.criteria.amount.enabled && data.criteria.amount.matchType === 'between') {
    const start = Number(data.criteria.amount.rangeStart);
    const end = Number(data.criteria.amount.rangeEnd);
    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End amount cannot be less than start amount",
        path: ["criteria", "amount", "rangeEnd"]
      });
    }
  }

  if (data.criteria.date.enabled && data.criteria.date.matchType === 'between') {
    const start = Number(data.criteria.date.rangeStart);
    const end = Number(data.criteria.date.rangeEnd);
    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End day cannot be less than start day",
        path: ["criteria", "date", "rangeEnd"]
      });
    }
  }
});

export type RuleFormValues = z.infer<typeof ruleFormSchema>;

type RuleFormProps = {
  onClose: () => void;
  accounts: Array<{
    budgetFinAccountId: string;
    name: string;
    balance: number;
    institutionName?: string;
    mask?: string;
  }>;
  categories: CategoryGroup[];
  tags: BudgetFinAccountTransactionTag[];
  budgetId: string;
  initialValues?: RuleFormValues;
}

export function RuleForm({ onClose, accounts, categories, budgetId, initialValues }: RuleFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { addBudgetRule, workspace } = useBudgetWorkspace();

  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: initialValues ?? {
      name: '',
      criteria: {
        merchantName: { enabled: false, matchType: 'contains' },
        amount: { enabled: false, matchType: 'exactly' },
        date: { enabled: false, matchType: 'exactly' },
        account: { enabled: false },
      },
      actions: {
        renameMerchant: { enabled: false },
        setNote: { enabled: false },
        setCategory: { enabled: false },
        addTags: { enabled: false },
      },
      isAppliedToAllTransactions: false,
    },
  });

  const watchMerchantEnabled = form.watch('criteria.merchantName.enabled');
  const watchAmountEnabled = form.watch('criteria.amount.enabled');
  const watchDateEnabled = form.watch('criteria.date.enabled');
  const watchAccountEnabled = form.watch('criteria.account.enabled');
  const watchRenameMerchantEnabled = form.watch('actions.renameMerchant.enabled');
  const watchSetNoteEnabled = form.watch('actions.setNote.enabled');
  const watchSetCategoryEnabled = form.watch('actions.setCategory.enabled');
  const watchAddTagsEnabled = form.watch('actions.addTags.enabled');

  const watchAmountMatchType = form.watch('criteria.amount.matchType');
  const watchDateMatchType = form.watch('criteria.date.matchType');

  async function onSubmit(data: RuleFormValues) {
    const hasAnyCriteriaEnabled = Object.values(data.criteria).some(criterion => criterion.enabled);
    const hasAnyActionEnabled = Object.values(data.actions).some(action => action.enabled);

    if (!hasAnyCriteriaEnabled || !hasAnyActionEnabled) {
      toast.error("A rule must have at least one criteria and one action enabled");
      return;
    }

    setIsSaving(true);
    try {
      const formattedAmount = data.criteria.amount.enabled ? {
        enabled: data.criteria.amount.enabled,
        matchType: data.criteria.amount.matchType,
        ...(data.criteria.amount.matchType === 'between' 
          ? {
              rangeStart: data.criteria.amount.rangeStart?.toString(),
              rangeEnd: data.criteria.amount.rangeEnd?.toString()
            }
          : {
              value: data.criteria.amount.value?.toString()
            }
        )
      } : { enabled: false };

      const formattedDate = data.criteria.date.enabled ? {
        enabled: data.criteria.date.enabled,
        matchType: data.criteria.date.matchType,
        ...(data.criteria.date.matchType === 'between'
          ? {
              rangeStart: data.criteria.date.rangeStart?.toString(),
              rangeEnd: data.criteria.date.rangeEnd?.toString()
            }
          : {
              value: data.criteria.date.value?.toString()
            }
        )
      } : { enabled: false };

      const response = await fetch(`/api/budgets/${budgetId}/rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          description: '',
          budgetId,
          conditions: {
            ...data.criteria,
            amount: formattedAmount,
            date: formattedDate
          },
          actions: data.actions,
          isActive: true,
          isAppliedToAllTransactions: data.isAppliedToAllTransactions,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create rule');
      }

      if (!result.rule) {
        throw new Error('No rule data returned from server');
      }

      addBudgetRule(result.rule);

      toast.success('Rule created successfully');
      onClose();
    } catch (error) {
      console.error('Error saving rule:', error);
      if (error instanceof Error) {
        if (error.message.includes('Failed to create rule')) {
          toast.error('Unable to create rule. Please try again.');
        } else if (error.message.includes('No rule data returned')) {
          toast.error('Server returned invalid data. Please try again.');
        } else {
          toast.error('An unexpected error occurred. Please try again.');
        }
      } else {
        toast.error('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="max-h-[80vh] overflow-y-auto p-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rule Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter rule name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">If a transaction meets these criteria</h3>
            
            <div className="space-y-4 rounded-lg border p-4">
              <FormField
                control={form.control}
                name="criteria.merchantName.enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel className="font-semibold">Matches merchant name</FormLabel>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormItem>
                )}
                
              />
              
              {watchMerchantEnabled && (
                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="criteria.merchantName.matchType"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select match type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="contains">contains</SelectItem>
                              <SelectItem value="exactly">exactly</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="criteria.merchantName.value"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input 
                            placeholder="Enter merchant name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <FormField
                control={form.control}
                name="criteria.amount.enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel className="font-semibold">Matches amount</FormLabel>
                    <Switch 
                      checked={field.value} 
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (checked) {
                          form.setValue('criteria.amount.matchType', 'exactly');
                        }
                      }} 
                    />
                  </FormItem>
                )}
              />
              
              {watchAmountEnabled && (
                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="criteria.amount.matchType"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select match type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="exactly">exactly</SelectItem>
                              <SelectItem value="between">between</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    {watchAmountMatchType === 'between' ? (
                      <>
                        <FormField
                          control={form.control}
                          name="criteria.amount.rangeStart"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input 
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="Start amount"
                                  {...field}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '') {
                                      field.onChange(value);
                                    } else {
                                      const numValue = parseFloat(value);
                                      if (numValue >= 0) {
                                        field.onChange(numValue);
                                      }
                                    }
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="criteria.amount.rangeEnd"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input 
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="End amount"
                                  {...field}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '') {
                                      field.onChange(value);
                                    } else {
                                      const numValue = parseFloat(value);
                                      if (numValue >= 0) {
                                        field.onChange(numValue);
                                      }
                                    }
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    ) : (
                      <FormField
                        control={form.control}
                        name="criteria.amount.value"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input 
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Enter amount"
                                {...field}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === '') {
                                    field.onChange(value);
                                  } else {
                                    const numValue = parseFloat(value);
                                    if (numValue >= 0) {
                                      field.onChange(numValue);
                                    }
                                  }
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <FormField
                control={form.control}
                name="criteria.date.enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel className="font-semibold">Matches day</FormLabel>
                    <Switch 
                      checked={field.value} 
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (checked) {
                          form.setValue('criteria.date.matchType', 'exactly');
                        }
                      }} 
                    />
                  </FormItem>
                )}
              />
              
              {watchDateEnabled && (
                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="criteria.date.matchType"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select match type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="exactly">exactly</SelectItem>
                              <SelectItem value="between">between</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    {watchDateMatchType === 'between' ? (
                      <>
                        <FormField
                          control={form.control}
                          name="criteria.date.rangeStart"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input 
                                  type="number"
                                  min="1"
                                  max="31"
                                  placeholder="Start day"
                                  {...field}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '') {
                                      field.onChange(value);
                                    } else {
                                      const numValue = parseInt(value);
                                      if (numValue >= 1 && numValue <= 31) {
                                        field.onChange(numValue);
                                      }
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const value = e.target.value;
                                    if (value === '') return;
                                    const numValue = parseInt(value);
                                    if (numValue < 1) field.onChange(1);
                                    if (numValue > 31) field.onChange(31);
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="criteria.date.rangeEnd"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input 
                                  type="number"
                                  min="1"
                                  max="31"
                                  placeholder="End day"
                                  {...field}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '') {
                                      field.onChange(value);
                                    } else {
                                      const numValue = parseInt(value);
                                      if (numValue >= 1 && numValue <= 31) {
                                        field.onChange(numValue);
                                      }
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const value = e.target.value;
                                    if (value === '') return;
                                    const numValue = parseInt(value);
                                    if (numValue < 1) field.onChange(1);
                                    if (numValue > 31) field.onChange(31);
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    ) : (
                      <FormField
                        control={form.control}
                        name="criteria.date.value"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input 
                                type="number"
                                min="1"
                                max="31"
                                placeholder="Day of month"
                                {...field}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === '') {
                                    field.onChange(value);
                                  } else {
                                    const numValue = parseInt(value);
                                    if (numValue >= 1 && numValue <= 31) {
                                      field.onChange(numValue);
                                    }
                                  }
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <FormField
                control={form.control}
                name="criteria.account.enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel className="font-semibold">From account</FormLabel>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormItem>
                )}
              />
              
              {watchAccountEnabled && (
                <FormField
                  control={form.control}
                  name="criteria.account.value"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          defaultValue={initialValues?.criteria.account.value}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((account) => (
                              <SelectItem key={account.budgetFinAccountId} value={account.budgetFinAccountId}>
                                <span className="text-sm capitalize flex items-center justify-between w-full">
                                  {`${account.institutionName || ''} - ${account.name}${account.mask ? ` - ***${account.mask}` : ''}`} -
                                  <span className="text-muted-foreground">
                                    &nbsp;${account.balance.toFixed(2)}
                                  </span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Then apply the following updates</h3>
            
            <div className="space-y-4 rounded-lg border p-4">
              <FormField
                control={form.control}
                name="actions.renameMerchant.enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel className="font-semibold">Rename merchant name</FormLabel>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormItem>
                )}
              />
              
              {watchRenameMerchantEnabled && (
                <FormField
                  control={form.control}
                  name="actions.renameMerchant.value"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input 
                          placeholder="Enter new merchant name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <FormField
                control={form.control}
                name="actions.setNote.enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel className="font-semibold">Set note</FormLabel>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormItem>
                )}
              />
              
              {watchSetNoteEnabled && (
                <FormField
                  control={form.control}
                  name="actions.setNote.value"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input {...field} placeholder="Enter note" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <FormField
                control={form.control}
                name="actions.setCategory.enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel className="font-semibold">Set category</FormLabel>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormItem>
                )}
              />
              
              {watchSetCategoryEnabled && (
                <FormField
                  control={form.control}
                  name="actions.setCategory.value"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <TransactionCategorySelect
                          value={field.value}
                          onValueChange={field.onChange}
                          categoryGroups={categories}
                          placeholder="Select category"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <FormField
                control={form.control}
                name="actions.addTags.enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel className="font-semibold">Set tags</FormLabel>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormItem>
                )}
              />
              
              {watchAddTagsEnabled && (
                <FormField
                  control={form.control}
                  name="actions.addTags.value"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <TransactionTagSelect
                          type="rules"
                          initialValue={field.value}
                          onTagsChange={(newTags: BudgetFinAccountTransactionTag[]) => {
                            field.onChange(newTags.map(tag => tag.id));
                          }}
                          disabled={isSaving}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </div>

          <FormField
            control={form.control}
            name="isAppliedToAllTransactions"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className="pb-2">Apply to existing transactions</FormLabel>
              </FormItem>
            )}
          />

          <div className="mt-6 flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button onClick={form.handleSubmit(onSubmit)} type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Create Rule'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
} 