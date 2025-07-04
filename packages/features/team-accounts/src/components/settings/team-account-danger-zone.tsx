'use client';

import { useFormStatus } from 'react-dom';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ErrorBoundary } from '@kit/monitoring/components';
import { useUser } from '@kit/supabase/hooks/use-user';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import { LoadingOverlay } from '@kit/ui/loading-overlay';
import { Trans } from '@kit/ui/trans';

import { deleteTeamAccountAction } from '../../server/actions/delete-team-account-server-actions';
import { leaveTeamAccountAction } from '../../server/actions/leave-team-account-server-actions';

export function TeamAccountDangerZone({
  account,
  primaryOwnerUserId,
  features,
}: React.PropsWithChildren<{
  account: {
    name: string;
    id: string;
  };

  features: {
    enableTeamDeletion: boolean;
  };

  primaryOwnerUserId: string;
}>) {
  const { data: user } = useUser();

  if (!user) {
    return <LoadingOverlay fullPage={false} />;
  }

  // Only the primary owner can delete the team account
  const userIsPrimaryOwner = user.id === primaryOwnerUserId;

  if (userIsPrimaryOwner && features.enableTeamDeletion) {
    return <DeleteTeamContainer account={account} />;
  }

  // A primary owner can't leave the team account
  // but other members can
  return <LeaveTeamContainer account={account} />;
}

function DeleteTeamContainer(props: {
  account: {
    name: string;
    id: string;
  };
}) {
  return (
    <div className={'flex flex-col space-y-4'}>
      <div className={'flex flex-col space-y-1'}>
        <span className={'font-medium'}>
          <Trans i18nKey={'budgets:deleteTeam'} />
        </span>

        <p className={'text-muted-foreground text-sm'}>
          <Trans
            i18nKey={'budgets:deleteTeamDescription'}
            values={{
              teamName: props.account.name,
            }}
          />
        </p>
      </div>

      <div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              data-test={'delete-team-trigger'}
              type={'button'}
              variant={'destructive'}
            >
              <Trans i18nKey={'budgets:deleteTeam'} />
            </Button>
          </AlertDialogTrigger>

          <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()}>
            <AlertDialogHeader>
              <AlertDialogTitle>
                <Trans i18nKey={'budgets:deletingTeam'} />
              </AlertDialogTitle>

              <AlertDialogDescription>
                <Trans
                  i18nKey={'budgets:deletingTeamDescription'}
                  values={{
                    teamName: props.account.name,
                  }}
                />
              </AlertDialogDescription>
            </AlertDialogHeader>

            <DeleteTeamConfirmationForm
              name={props.account.name}
              id={props.account.id}
            />
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function DeleteTeamConfirmationForm({
  name,
  id,
}: {
  name: string;
  id: string;
}) {
  const form = useForm({
    mode: 'onChange',
    reValidateMode: 'onChange',
    resolver: zodResolver(
      z.object({
        name: z.string().refine((value) => value === name, {
          message: 'Name does not match',
          path: ['name'],
        }),
      }),
    ),
    defaultValues: {
      name: '',
    },
  });

  return (
    <ErrorBoundary fallback={<DeleteTeamErrorAlert />}>
      <Form {...form}>
        <form
          data-test={'delete-team-form'}
          className={'flex flex-col space-y-4'}
          action={deleteTeamAccountAction}
        >
          <div className={'flex flex-col space-y-2'}>
            <div
              className={
                'border-2 border-red-500 p-4 text-sm text-red-500' +
                ' my-4 flex flex-col space-y-2'
              }
            >
              <div>
                <Trans
                  i18nKey={'budgets:deleteTeamDisclaimer'}
                  values={{
                    teamName: name,
                  }}
                />
              </div>

              <div className={'text-sm'}>
                <Trans i18nKey={'common:modalConfirmationQuestion'} />
              </div>
            </div>

            <input type="hidden" value={id} name={'accountId'} />

            <FormField
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans i18nKey={'budgets:budgetNameInputLabel'} />
                  </FormLabel>

                  <FormControl>
                    <Input
                      data-test={'delete-team-form-confirm-input'}
                      required
                      type={'text'}
                      autoComplete={'off'}
                      className={'w-full'}
                      placeholder={''}
                      pattern={name}
                      {...field}
                    />
                  </FormControl>

                  <FormDescription>
                    <Trans i18nKey={'budgets:deleteTeamInputField'} />
                  </FormDescription>

                  <FormMessage />
                </FormItem>
              )}
              name={'confirm'}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans i18nKey={'common:cancel'} />
            </AlertDialogCancel>

            <DeleteTeamSubmitButton />
          </AlertDialogFooter>
        </form>
      </Form>
    </ErrorBoundary>
  );
}

function DeleteTeamSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      data-test={'delete-team-form-confirm-button'}
      disabled={pending}
      variant={'destructive'}
    >
      <Trans i18nKey={'budgets:deleteTeam'} />
    </Button>
  );
}

function LeaveTeamContainer(props: {
  account: {
    name: string;
    id: string;
  };
}) {
  const form = useForm({
    resolver: zodResolver(
      z.object({
        confirmation: z.string().refine((value) => value === 'LEAVE', {
          message: 'Confirmation required to leave team',
          path: ['confirmation'],
        }),
      }),
    ),
    defaultValues: {
      confirmation: '',
    },
  });

  return (
    <div className={'flex flex-col space-y-4'}>
      <p className={'text-muted-foreground text-sm'}>
        <Trans
          i18nKey={'budgets:leaveBudgetDescription'}
          values={{
            teamName: props.account.name,
          }}
        />
      </p>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <div>
            <Button
              data-test={'leave-team-button'}
              type={'button'}
              variant={'destructive'}
            >
              <Trans i18nKey={'budgets:leaveBudget'} />
            </Button>
          </div>
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans i18nKey={'budgets:leavingTeamModalHeading'} />
            </AlertDialogTitle>

            <AlertDialogDescription>
              <Trans i18nKey={'budgets:leavingTeamModalDescription'} />
            </AlertDialogDescription>
          </AlertDialogHeader>

          <ErrorBoundary fallback={<LeaveTeamErrorAlert />}>
            <Form {...form}>
              <form
                className={'flex flex-col space-y-4'}
                action={leaveTeamAccountAction}
              >
                <input
                  type={'hidden'}
                  value={props.account.id}
                  name={'accountId'}
                />

                <FormField
                  name={'confirmation'}
                  render={({ field }) => {
                    return (
                      <FormItem>
                        <FormLabel>
                          <Trans i18nKey={'budgets:leaveBudgetInputLabel'} />
                        </FormLabel>

                        <FormControl>
                          <Input
                            data-test="leave-team-input-field"
                            type="text"
                            className="w-full"
                            autoComplete={'off'}
                            placeholder=""
                            pattern="LEAVE"
                            required
                            {...field}
                          />
                        </FormControl>

                        <FormDescription>
                          <Trans i18nKey={'budgets:leaveBudgetInputDescription'} />
                        </FormDescription>

                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <AlertDialogFooter>
                  <AlertDialogCancel>
                    <Trans i18nKey={'common:cancel'} />
                  </AlertDialogCancel>

                  <LeaveTeamSubmitButton />
                </AlertDialogFooter>
              </form>
            </Form>
          </ErrorBoundary>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LeaveTeamSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      data-test={'confirm-leave-organization-button'}
      disabled={pending}
      variant={'destructive'}
    >
      <Trans i18nKey={'budgets:leaveBudget'} />
    </Button>
  );
}

function LeaveTeamErrorAlert() {
  return (
    <>
      <Alert variant={'destructive'}>
        <AlertTitle>
          <Trans i18nKey={'budgets:leaveBudgetErrorHeading'} />
        </AlertTitle>

        <AlertDescription>
          <Trans i18nKey={'common:genericError'} />
        </AlertDescription>
      </Alert>

      <AlertDialogFooter>
        <AlertDialogCancel>
          <Trans i18nKey={'common:cancel'} />
        </AlertDialogCancel>
      </AlertDialogFooter>
    </>
  );
}

function DeleteTeamErrorAlert() {
  return (
    <Alert variant={'destructive'}>
      <AlertTitle>
        <Trans i18nKey={'budgets:deleteTeamErrorHeading'} />
      </AlertTitle>

      <AlertDescription>
        <Trans i18nKey={'common:genericError'} />
      </AlertDescription>
    </Alert>
  );
}
