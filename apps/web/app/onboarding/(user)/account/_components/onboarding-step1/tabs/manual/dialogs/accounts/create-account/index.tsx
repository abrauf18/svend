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
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useOnboardingContext } from '~/components/onboarding-context';
import RenderError from '~/components/ui/forms/render-error';
import Tooltip from '~/components/ui/tooltip';
import { AccountOnboardingInstitution } from '~/lib/model/onboarding.types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@kit/ui/form";

const accountSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Name should have between 1 and 50 characters' })
    .max(50, { message: 'Name should have between 1 and 50 characters' }),
  type: z.enum(['depository', 'credit', 'loan', 'investment', 'other'], {
    errorMap: () => ({ message: 'Please select an account type' }),
  }),
  mask: z
    .string()
    .length(4, { message: 'Mask must be 4 digits' })
    .refine((data) => (data.match(/[^0-9]/g) ? false : true), {
      message: 'Mask should contain only numbers',
    }),
  balanceCurrent: z.string()
    .min(1)
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0),
});

type Props = {
  setIsAddingAccount: React.Dispatch<React.SetStateAction<boolean>>;
  institution: AccountOnboardingInstitution;
};

export default function CreateAccount({
  setIsAddingAccount,
  institution,
}: Props) {
  const { accountManualAccountAddOne } = useOnboardingContext();

  const checkIfAccountNameExists = useCallback(
    (name: string) => {
      if (!institution) return false;

      return institution.accounts.some(
        (acc) =>
          (acc.name ?? '').trim().toLowerCase() ===
          (name ?? '').trim().toLowerCase(),
      );
    },
    [institution],
  );

  const [isDialogOpened, setIsDialogOpened] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [balanceInput, setBalanceInput] = useState('0.00');

  const formatBalance = useCallback((value: string) => {
    // Remove all non-numeric characters except decimal point
    const cleanValue = value.replace(/[^\d.]/g, '');
    
    // Ensure only one decimal point
    const parts = cleanValue.split('.');
    const whole = parts[0] || '0';
    const decimal = parts[1] || '00';
    
    // Format to exactly 2 decimal places
    return `${whole}.${decimal.slice(0, 2).padEnd(2, '0')}`;
  }, []);

  const form = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    mode: 'onChange',
    defaultValues: {
      balanceCurrent: '0.00',
    },
  });

  const { formState, setError, setValue } = form;

  const handleBalanceBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const numericValue = parseFloat(rawValue);
    
    if (isNaN(numericValue)) {
      setBalanceInput('0.00');
      setValue('balanceCurrent', '0.00');
      return;
    }

    const formattedValue = formatBalance(Math.max(0, numericValue).toString());
    setBalanceInput(formattedValue);
    setValue('balanceCurrent', formattedValue);
  }, [formatBalance, setValue]);

  async function handleCreateAccount(data: z.infer<typeof accountSchema>) {
    if (checkIfAccountNameExists(data.name))
      return setError('name', {
        message: 'The account already exists',
        type: 'custom',
      });

    try {
      setIsLoading(true);

      const res = await fetch('/api/onboarding/account/manual/accounts', {
        method: 'POST',
        body: JSON.stringify({ 
          ...data, 
          balanceCurrent: parseFloat(data.balanceCurrent),
          institutionId: institution.id
        }),
      });

      if (!res.ok) throw new Error(res.statusText);

      const { accountId, budgetId } = await res.json();

      accountManualAccountAddOne(institution.id, {
        name: data.name,
        id: accountId,
        type: data.type,
        transactions: [],
        budgetFinAccountId: budgetId,
        institutionId: institution.id,
        mask: data.mask,
        balanceCurrent: parseFloat(data.balanceCurrent),
      });

      toast.success('Account created successfully');

      form.reset();
    } catch (err: any) {
      console.error('Unknown server error');
      toast.error('Account could not be created');
    } finally {
      setIsDialogOpened(false);
      setIsLoading(false);
      setIsAddingAccount(false);
    }
  }

  function handleDialogState(open: boolean) {
    setIsDialogOpened(open);
    setIsAddingAccount(open);

    if (formState.isDirty && !open) form.reset();
  }

  return (
    <Dialog open={isDialogOpened} onOpenChange={handleDialogState}>
      <DialogTrigger asChild>
        <button
          onClick={() => setIsDialogOpened(true)}
          className={`flex w-full flex-shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border bg-muted/10 px-4 py-3 font-medium text-muted-foreground hover:bg-muted/30`}
        >
          <PlusIcon className={`size-5`} />
          Add Account
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Add Account{' '}
            <span className={`font-normal text-muted-foreground`}>
              &#8594;{' '}
              {(institution.name.length > 30
                ? institution.name.slice(0, 30) + '...'
                : institution.name)}
            </span>
          </DialogTitle>
          <DialogDescription>
            Add account to{' '}
            {institution.name.length > 30
              ? institution.name.slice(0, 30) + '...' + ` (${institution.symbol})`
              : institution.name + ` (${institution.symbol})`}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className={`flex flex-col gap-4`}
            onSubmit={form.handleSubmit((data) =>
              handleCreateAccount({
                name: data.name,
                type: data.type,
                mask: data.mask,
                balanceCurrent: data.balanceCurrent,
              }),
            )}
          >
            <div className={`flex w-full flex-col gap-6`}>
              <div className={`flex flex-col gap-2`}>
                <Label htmlFor="name">
                  Name<span className="text-destructive">*</span>
                </Label>
                <Input
                  {...form.register('name')}
                  placeholder="Name"
                  className={`w-full`}
                  id="name"
                />
                <RenderError formState={formState} name="name" />
              </div>
              <div className={`flex flex-col gap-2`}>
                <Label htmlFor="mask" className={`flex items-center`}>
                  Mask<span className="text-destructive">*</span>
                  <Tooltip
                    className={`ml-2`}
                    message="The last 4 digits of your account number"
                  />
                </Label>
                <Input
                  {...form.register('mask')}
                  placeholder="1234"
                  className={`w-full`}
                  id="mask"
                />
                <RenderError formState={formState} name="mask" />
              </div>
              <div className={`flex flex-col gap-2`}>
                <Label htmlFor="type">
                  Type<span className="text-destructive">*</span>
                </Label>
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an account type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="depository">Depository</SelectItem>
                          <SelectItem value="credit">Credit</SelectItem>
                          <SelectItem value="loan">Loan</SelectItem>
                          <SelectItem value="investment">Investment</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <RenderError formState={formState} name="type" />
              </div>
              <div className={`flex flex-col gap-2`}>
                <Label htmlFor="balanceCurrent">
                  Current Balance<span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    {...form.register('balanceCurrent')}
                    value={balanceInput}
                    onChange={(e) => setBalanceInput(e.target.value)}
                    onBlur={handleBalanceBlur}
                    placeholder="0.00"
                    className="pl-7 w-full"
                    id="balance_current"
                    type="text"
                    inputMode="decimal"
                  />
                </div>
                <RenderError formState={formState} name="balanceCurrent" />
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
                  'Create Account'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
