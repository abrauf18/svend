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
import { Loader2, Pencil } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useOnboardingContext } from '~/components/onboarding-context';
import RenderError from '~/components/ui/forms/render-error';
import Tooltip from '~/components/ui/tooltip';
import { AccountOnboardingInstitution } from '~/lib/model/onboarding.types';

const institutionSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Name should have between 1 and 50 characters' })
    .max(50, { message: 'Name should have between 1 and 50 characters' }),
  symbol: z
    .string({
      invalid_type_error: 'Invalid symbol',
      required_error: 'Symbol is a required field',
    })
    .min(3, { message: 'Symbol must be 3 to 5 letters' })
    .max(5, { message: 'Symbol must be 3 to 5 letters' })
    .refine(
      (data) => {
        if (data.match(/[0-9]/g)) return false;
        return true;
      },
      { message: 'Numbers are not allowed' },
    )
    .transform((data) => data.trim().toUpperCase().replace(/[0-9]/g, '')),
});

type Props = {
  institution: AccountOnboardingInstitution;
};

export default function UpdateInstitution({ institution }: Props) {
  const { state, accountManualInstitutionsUpdateOne } = useOnboardingContext();

  const [isDialogOpened, setIsDialogOpened] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, reset, formState, setError } = useForm<
    z.infer<typeof institutionSchema>
  >({
    resolver: zodResolver(institutionSchema),
    mode: 'onChange',
    defaultValues: {
      name: institution.name,
      symbol: institution.symbol,
    },
  });

  const checkIfInstitutionExists = useCallback(
    (name: string) => {
      if (!state.account.manualInstitutions) return false;

      return state.account.manualInstitutions.some(
        (institution) =>
          (institution.name ?? '').trim().toLowerCase() ===
          (name ?? '').trim().toLowerCase(),
      );
    },
    [state.account.manualInstitutions],
  );

  const checkIfSymbolExists = useCallback(
    (symbol: string) => {
      if (!state.account.manualInstitutions) return false;

      return state.account.manualInstitutions.some(
        (institution) => institution.symbol === symbol,
      );
    },
    [state.account.manualInstitutions],
  );

  async function handleUpdateInstitution(
    data: z.infer<typeof institutionSchema>,
  ) {
    if (checkIfInstitutionExists(data.name) && data.name !== institution.name)
      return setError('name', {
        message: 'The institution already exists',
        type: 'custom',
      });

    if (checkIfSymbolExists(data.symbol) && data.symbol !== institution.symbol)
      return setError('symbol', {
        message: 'The symbol already exists',
        type: 'custom',
      });

    try {
      setIsLoading(true);

      const res = await fetch(
        `/api/onboarding/account/manual/institutions/${institution.id}`,
        {
          method: 'PUT',
          body: JSON.stringify(data),
        },
      );

      if (!res.ok) throw new Error(res.statusText);

      accountManualInstitutionsUpdateOne(institution.id, data);

      toast.success('Institution updated successfully');

      reset({
        name: data.name,
        symbol: data.symbol,
      });
    } catch (err: any) {
      console.error('Unknown server error');

      toast.error('Institution could not be updated');
    } finally {
      setIsDialogOpened(false);
      setIsLoading(false);
    }
  }

  function handleDialogState(open: boolean) {
    setIsDialogOpened(open);

    if (formState.isDirty && !open) reset();
  }

  return (
    <Dialog open={isDialogOpened} onOpenChange={handleDialogState}>
      <DialogTrigger asChild>
        <button
          onClick={() => setIsDialogOpened(true)}
          className={`flex aspect-square items-center justify-center gap-2 rounded-full p-2 font-medium text-primary hover:bg-primary/10`}
        >
          <Pencil className={`size-5`} />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Institution</DialogTitle>
          <DialogDescription>
            Update the financial institution&apos;s details.
          </DialogDescription>
        </DialogHeader>
        <form
          className={`flex flex-col gap-4`}
          onSubmit={handleSubmit((data) =>
            handleUpdateInstitution({ name: data.name, symbol: data.symbol }),
          )}
        >
          <div className={`flex flex-col gap-2`}>
            <Label htmlFor="name">
              Name<span className="text-destructive">*</span>
            </Label>
            <Input {...register('name')} placeholder="Name" />
            <RenderError formState={formState} name="name" />
          </div>
          <div className={`flex flex-col gap-2`}>
            <Label htmlFor="name" className={`flex items-center`}>
              Symbol<span className="text-destructive">*</span>{' '}
              <Tooltip
                className={`ml-2`}
                message="A 3-5 letter code (e.g., CHASE, BOA) to quickly identify your institution"
              />
            </Label>
            <Input
              {...register('symbol')}
              placeholder="Symbol"
              onInput={(e) =>
                (e.currentTarget.value = e.currentTarget.value.toUpperCase())
              }
            />
            <RenderError formState={formState} name="symbol" />
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
                'Update Institution'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
