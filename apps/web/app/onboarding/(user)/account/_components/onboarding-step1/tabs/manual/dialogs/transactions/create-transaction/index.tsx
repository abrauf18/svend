import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Loader2, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useOnboardingContext } from '~/components/onboarding-context';
import RenderError from '~/components/ui/forms/render-error';
import { TransactionCategorySelect } from '~/home/[account]/manage/_components/tabs/_shared/transaction-category-select';
import { AccountOnboardingInstitutionAccount } from '~/lib/model/onboarding.types';
import TransactionIdInput from './components/transaction-id-input';

const institutionSchema = z.object({
  date: z.string().min(1, { message: 'Date is a required field' }),
  amount: z
    .number({
      required_error: 'Amount is a required field',
      invalid_type_error: 'Must be a valid number',
    })
    .min(1),
  svend_category_id: z
    .string()
    .min(1, { message: 'Category is a required field' }),
  user_tx_id: z
    .string({
      invalid_type_error:
        'Transaction Id should have between 6 and 20 characters',
      required_error: 'Transaction Id is a required field',
    })
    .min(6, { message: 'Transaction Id should have at least 6 characters' })
    .max(20, { message: 'Transaction Id should have at most 20 characters' })
    .refine((data) => (data.match(/[a-z]/g) ? false : true), {
      message: 'Only capital letters are allowed',
    }),
});

type Props = {
  manualAccount: AccountOnboardingInstitutionAccount;
  institutionSymbol: string;
};

export default function CreateTransaction({
  manualAccount,
  institutionSymbol,
}: Props) {
  const { state, accountManualTransactionCreateOne } = useOnboardingContext();

  const categories = state.account.svendCategoryGroups!;

  const [isDialogOpened, setIsDialogOpened] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState,
    setError,
  } = useForm<z.infer<typeof institutionSchema>>({
    resolver: zodResolver(institutionSchema),
    mode: 'onChange',
    defaultValues: {
      amount: 0,
    },
  });

  async function handleCreateTransaction(
    data: z.infer<typeof institutionSchema>,
  ) {
    if (!isAutoGenerating) {
      const transactionIdAlreadyExists = manualAccount?.transactions.find(
        (trans) => trans.user_tx_id === data.user_tx_id,
      );

      if (transactionIdAlreadyExists)
        setError('user_tx_id', {
          message: 'Transaction Id already exists',
          type: 'custom',
        });

      return;
    }

    if (new Date(data.date) > new Date()) {
      setError('date', {
        message: 'Date cannot be in the future',
        type: 'custom',
      });

      return;
    }

    try {
      setIsLoading(true);

      const res = await fetch('/api/onboarding/account/manual/transactions', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          manual_account_id: manualAccount.id,
        }),
      });

      if (!res.ok) throw new Error(res.statusText);

      const { transactionId } = await res.json();

      accountManualTransactionCreateOne(manualAccount.id, {
        ...data,
        id: transactionId,
        plaid_tx_id: null,
        manual_account_id: manualAccount.id,
        created_at: null,
        updated_at: null,
        iso_currency_code: null,
        merchant_name: null,
        payee: null,
        plaid_account_id: null,
        plaid_category_confidence: null,
        plaid_category_detailed: null,
        plaid_raw_data: {},
      });

      toast.success('Transaction created successfully');

      reset();
    } catch (err: any) {
      console.error('Unknown server error');

      toast.error('Transaction could not be created');
    } finally {
      setIsDialogOpened(false);
      setIsLoading(false);
    }
  }

  function handleDialogState(open: boolean) {
    setIsDialogOpened(open);

    if (formState.isDirty && !open) reset();
  }

  const svendCategoryId = watch('svend_category_id');

  return (
    <Dialog open={isDialogOpened} onOpenChange={handleDialogState}>
      <DialogTrigger asChild>
        <button
          onClick={() => setIsDialogOpened(true)}
          disabled={!manualAccount?.budgetFinAccountId}
          className={`flex flex-shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border bg-muted/10 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <PlusIcon className={`size-5`} />
          Add Transaction
        </button>
      </DialogTrigger>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            Add Transaction{' '}
            <span className={`font-normal text-muted-foreground`}>
              &#8594; {institutionSymbol}{' '}
            </span>
            <span className={`font-normal text-muted-foreground`}>
              &#8594; {manualAccount?.name.length > 20 
                ? manualAccount?.name.slice(0, 20) + '...' 
                : manualAccount?.name}
            </span>
          </DialogTitle>
          <DialogDescription>
            Add transaction to {manualAccount?.name.length > 20 
              ? manualAccount?.name.slice(0, 20) + '...' 
              : manualAccount?.name} (****{manualAccount?.mask})
          </DialogDescription>
        </DialogHeader>
        <form
          className={`flex flex-col gap-4`}
          onSubmit={handleSubmit((data) =>
            handleCreateTransaction({
              amount: data.amount,
              date: data.date,
              svend_category_id: data.svend_category_id,
              user_tx_id: data.user_tx_id,
            }),
          )}
        >
          <div className={`flex flex-col gap-6`}>
            <div className={`relative flex flex-col gap-2`}>
              <Label htmlFor="date">
                Transaction Id<span className="text-destructive">*</span>
              </Label>
              <TransactionIdInput
                state={state}
                accountId={manualAccount.id}
                setValue={setValue}
                watch={watch}
                isAutoGenerating={isAutoGenerating}
                setIsAutoGenerating={setIsAutoGenerating}
              />
              <RenderError formState={formState} name="user_tx_id" />
            </div>
            <div className={`relative flex flex-col gap-2`}>
              <Label htmlFor="date">
                Date<span className="text-destructive">*</span>
              </Label>
              <Input {...register('date')} type="date" id="date" />
              <RenderError formState={formState} name="date" />
            </div>
            <div className={`relative flex w-full flex-col gap-2`}>
              <Label htmlFor="amount">
                Amount<span className="text-destructive">*</span>
              </Label>

              <Input
                id="amount"
                type="text"
                placeholder="0.00"
                {...register('amount', { valueAsNumber: true })}
                onInput={(e) =>
                  (e.currentTarget.value = e.currentTarget.value.replace(
                    /[^0-9.]/g,
                    '',
                  ))
                }
              />

              <RenderError formState={formState} name="amount" />
            </div>

            <div className={`flex flex-col gap-2`}>
              <Label htmlFor="svend_category_id">
                Category<span className="text-destructive">*</span>
              </Label>

              <TransactionCategorySelect
                value={svendCategoryId}
                onValueChange={(value) => {
                  setValue('svend_category_id', value, {
                    shouldValidate: true,
                  });
                }}
                categoryGroups={Object.values(categories)}
              />
              <RenderError formState={formState} name="svend_category_id" />
            </div>
          </div>
          <div className={`flex items-center justify-end gap-2`}>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogState(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>

            <Button
              disabled={isLoading || Object.values(formState.errors).length > 0}
              type="submit"
              variant="default"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Create Transaction'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
