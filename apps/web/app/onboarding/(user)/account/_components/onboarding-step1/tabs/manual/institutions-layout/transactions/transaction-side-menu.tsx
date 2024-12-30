import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@kit/ui/sheet';
import { Spinner } from '@kit/ui/spinner';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useOnboardingContext } from '~/components/onboarding-context';
import RenderError from '~/components/ui/forms/render-error';
import { TransactionCategorySelect } from '~/home/[account]/manage/_components/tabs/_shared/transaction-category-select';
import { getCurrencySymbol } from '~/utils/transactions/get-currency-symbol';

const transactionFormSchema = z.object({
  date: z.string({
    required_error: 'Date is a required field',
  }),
  svend_category_id: z.string().min(1, 'Category is a required field'),
  amount: z
    .string()
    .min(1, 'Amount is a required field')
    .transform((val) => val.replace(/[^0-9.-]/g, ''))
    .refine((val) => !isNaN(Number(val)), {
      message: 'Must be a valid number',
    }),
  manual_account_id: z.string().min(1, 'Account is a required field'),
  user_tx_id: z
    .string({
      invalid_type_error: 'Transaction ID must be 6-20 uppercase characters',
      required_error: 'Transaction ID must be 6-20 uppercase characters',
    })
    .min(6, { message: 'Transaction ID must be 6-20 uppercase characters' })
    .max(20, { message: 'Transaction ID must be 6-20 uppercase characters' })
    .refine((data) => (data.match(/[a-z]/g) ? false : true), {
      message: 'Transaction ID must be 6-20 uppercase characters',
    })
    .refine((data) => (data.match(/[a-z]/g) ? false : true), {
      message: 'Only capital letters are allowed',
    }),
  merchant_name: z.string().optional(),
});

type TransactionPutResponse = {
  error?: string;
  message?: string;
  data?: {
    date: string;
    amount: string;
    svend_category_id: string;
    manual_account_id: string;
  };
  transactionId?: string;
};

export default function TransactionSideMenu() {
  const {
    state,
    accountManualTransactionUpdate,
    accountTransactionsSideMenuSetSelectedTransaction,
  } = useOnboardingContext();

  const selectedTransaction =
    state.account.transactions?.sideMenu?.selectedTransaction;

  const [isLoading, setIsLoading] = useState(false);

  const transaction = useMemo(() => {
    if (!state.account.manualInstitutions || !selectedTransaction) return null;

    return state.account.manualInstitutions
      .flatMap((inst) => inst.accounts)
      .flatMap((acc) => acc.transactions)
      .find((t) => t.id === selectedTransaction);
  }, [state.account.manualInstitutions, selectedTransaction]);

  const accounts = useMemo(() => {
    if (!state.account.manualInstitutions) return {};

    const parsedAccounts: Record<string, any[]> = {};

    state.account.manualInstitutions.forEach((inst) => {
      const key = `${inst.name}-${inst.id}`;
      parsedAccounts[key] = structuredClone(inst.accounts);
    });

    return parsedAccounts;
  }, [state.account.manualInstitutions]);

  const categories = state.account.svendCategoryGroups!;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState,
    setError,
  } = useForm<z.infer<typeof transactionFormSchema>>({
    resolver: zodResolver(transactionFormSchema),
    mode: 'onChange',
  });

  useEffect(() => {
    if (transaction) {
      reset({
        amount: transaction.amount.toFixed(2),
        svend_category_id: transaction.svend_category_id,
        date: transaction.date,
        manual_account_id: transaction.manual_account_id ?? '',
        user_tx_id: transaction.user_tx_id,
        merchant_name: transaction.merchant_name ?? '',
      });
    }
  }, [transaction]);

  if (!transaction) return null;

  function handleOpenChange(open: boolean) {
    if (!open) accountTransactionsSideMenuSetSelectedTransaction(undefined);
  }

  async function handleSubmitTransaction(
    data: z.infer<typeof transactionFormSchema>,
  ) {
    if (new Date(data.date) > new Date()) {
      setError('date', {
        message: 'Date cannot be in the future',
        type: 'custom',
      });

      return;
    }

    try {
      setIsLoading(true);

      const res = await fetch(
        `/api/onboarding/account/manual/transactions/${transaction?.id}`,
        { method: 'PUT', body: JSON.stringify({
          ...data,
          amount: Number(data.amount),
        }) },
      );

      if (!res.ok) throw new Error(res.statusText);

      const {
        data: responseData,
        transactionId,
        error,
      } = (await res.json()) as TransactionPutResponse;

      if (!responseData || error)
        throw new Error(
          `[Side Menu] Transaction could not be updated: ${error}`,
        );

      accountManualTransactionUpdate(transactionId!, responseData);

      toast.success('Transaction updated successfully', {
        position: 'bottom-left',
      });

      setIsLoading(false);
    } catch (err: any) {
      console.error('Unknown server error');

      toast.error('Transaction could not be updated', {
        position: 'bottom-left',
      });

      setIsLoading(false);
    }
  }

  return (
    <Sheet open={!!transaction} onOpenChange={handleOpenChange}>
      <SheetContent>
        <SheetHeader className="pb-10">
          <SheetTitle>Transaction Details</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={handleSubmit(handleSubmitTransaction)}
          className={`flex h-full max-h-[calc(100dvh-6rem)] flex-col gap-8`}
        >
          <div className={`flex flex-col gap-4`}>
            <Label>
              Transaction Id<span className="text-destructive">*</span>
            </Label>
            <Input
              {...register('user_tx_id')}
              onInput={(e) =>
                (e.currentTarget.value = e.currentTarget.value.toUpperCase())
              }
            />
            <RenderError formState={formState} name="user_tx_id" />
          </div>
          <div className={`flex flex-col gap-4`}>
            <Label htmlFor="date">
              Date<span className="text-destructive">*</span>
            </Label>
            <Input {...register('date')} type="date" id="date" />
            <RenderError formState={formState} name="date" />
          </div>
          <div className={`flex flex-col gap-4`}>
            <Label htmlFor="amount">
              Amount<span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {transaction.iso_currency_code
                  ? getCurrencySymbol(transaction.iso_currency_code)
                  : '$'}
              </span>
              <Input
                id="amount"
                type="text"
                placeholder="0.00"
                className="pl-8"
                {...register('amount')}
                onInput={(e) => {
                  let value = e.currentTarget.value.replace(/[^0-9.-]/g, '');
                  const decimalCount = (value.match(/\./g) || []).length;
                  if (decimalCount > 1) {
                    value = value.replace(/\.(?=.*\.)/g, '');
                  }
                  e.currentTarget.value = value;
                }}
                onBlur={(e) => {
                  const value = e.currentTarget.value;
                  const numericValue = Number(value);
                  
                  if (isNaN(numericValue)) {
                    // Revert to previous valid value
                    e.currentTarget.value = transaction.amount.toFixed(2);
                    setValue('amount', transaction.amount.toFixed(2));
                    return;
                  }

                  const roundedValue = numericValue.toFixed(2);
                  e.currentTarget.value = roundedValue;
                  setValue('amount', roundedValue);
                }}
              />
            </div>
            <RenderError formState={formState} name="amount" />
          </div>
          <div className={`flex flex-col gap-4`}>
            <Label htmlFor="category">
              Category<span className="text-destructive">*</span>
            </Label>
            <TransactionCategorySelect
              value={watch('svend_category_id')}
              onValueChange={(value) => {
                setValue('svend_category_id', value);
              }}
              categoryGroups={Object.values(categories)}
            />
            <RenderError formState={formState} name="svend_category_id" />
          </div>
          <div className={`flex flex-col gap-4`}>
            <Label htmlFor="account">
              Account<span className="text-destructive">*</span>
            </Label>
            <Select
              value={watch('manual_account_id')}
              onValueChange={(value) => setValue('manual_account_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(accounts).map(([instName, accounts]) => (
                  <div key={instName} className={`flex flex-col gap-2 text-sm`}>
                    <p className={`pl-2 pt-2 text-muted-foreground`}>
                      {(instName.split('-')[0] ?? '').length > 40
                        ? (instName.split('-')[0] ?? '').slice(0, 40) + '...'
                        : (instName.split('-')[0] ?? '')}
                    </p>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id} className="pl-8">
                        <span className="text-sm capitalize">{acc.name}</span>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
            <RenderError formState={formState} name="manual_account_id" />
          </div>
          <div className={`flex flex-col gap-4`}>
            <Label>Merchant Name</Label>
            <Input {...register('merchant_name')} placeholder="Enter merchant name" />
            <RenderError formState={formState} name="merchant_name" />
          </div>
          <div className="mt-auto flex border-t bg-background p-4">
            <div className="flex w-full flex-col gap-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={!formState.isValid || isLoading}
                className="w-full sm:w-auto"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    Saving...
                    <Spinner className={`fill-black dark:fill-white`} />
                  </div>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
