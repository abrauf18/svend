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
import { Landmark, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Trans } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { useOnboardingContext } from '~/components/onboarding-context';
import RenderError from '~/components/ui/forms/render-error';
import Tooltip from '~/components/ui/tooltip';

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
  setIsCreatingInstitution: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function CreateInstitution({ setIsCreatingInstitution }: Props) {
  const { accountManualInstitutionsAddOne, state } = useOnboardingContext();

  const [isDialogOpened, setIsDialogOpened] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, reset, formState, setError } = useForm<
    z.infer<typeof institutionSchema>
  >({
    resolver: zodResolver(institutionSchema),
    mode: 'onChange',
  });

  function checkIfInstitutionExists(name: string) {
    if (!state.account.manualInstitutions) return false;

    return state.account.manualInstitutions.some(
      (institution) =>
        (institution.name ?? '').trim().toLowerCase() ===
        (name ?? '').trim().toLowerCase(),
    );
  }

  async function handleCreateInstitution(
    data: z.infer<typeof institutionSchema>,
  ) {
    if (checkIfInstitutionExists(data.name))
      return setError('name', {
        message: 'The institution already exists',
        type: 'custom',
      });

    try {
      setIsLoading(true);

      const res = await fetch('/api/onboarding/account/manual/institutions', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error(res.statusText);

      const { institutionId } = await res.json();

      accountManualInstitutionsAddOne({
        name: data.name,
        accounts: [],
        id: institutionId,
        symbol: data.symbol,
      });

      toast.success('Institution created successfully');

      reset();
    } catch (err: any) {
      console.error('Unknown server error');

      toast.error('Institution could not be created');
    } finally {
      setIsDialogOpened(false);
      setIsLoading(false);
      setIsCreatingInstitution(false);
    }
  }

  function handleDialogState(open: boolean) {
    setIsDialogOpened(open);
    setIsCreatingInstitution(open);

    if (formState.isDirty && !open) reset();
  }

  return (
    <Dialog open={isDialogOpened} onOpenChange={handleDialogState}>
      <DialogTrigger asChild>
        <Button 
          onClick={() => setIsDialogOpened(true)} 
          className="w-fit"
        >
          <Landmark className="size-5 mr-2" />
          <Trans i18nKey={'onboarding:connectManualInstitutionButtonLabel'} />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Institution</DialogTitle>
          <DialogDescription>
            Add a new financial institution to manage your accounts and
            transactions.
          </DialogDescription>
        </DialogHeader>
        <form
          className={`flex flex-col gap-4`}
          onSubmit={handleSubmit((data) =>
            handleCreateInstitution({ name: data.name, symbol: data.symbol }),
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
                'Create Institution'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
