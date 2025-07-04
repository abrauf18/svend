'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
import { If } from '@kit/ui/if';
import { Input } from '@kit/ui/input';
import { Trans } from '@kit/ui/trans';

import { TransferOwnershipConfirmationSchema } from '../../schema/transfer-ownership-confirmation.schema';
import { transferOwnershipAction } from '../../server/actions/team-members-server-actions';

export function TransferOwnershipDialog({
  isOpen,
  setIsOpen,
  targetDisplayName,
  teamAccountId: accountId,
  userId,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  teamAccountId: string;
  userId: string;
  targetDisplayName: string;
}) {
  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <Trans i18nKey="budgets:transferOwnership" />
          </AlertDialogTitle>

          <AlertDialogDescription>
            <Trans i18nKey="budgets:transferOwnershipDescription" />
          </AlertDialogDescription>
        </AlertDialogHeader>

        <TransferOrganizationOwnershipForm
          accountId={accountId}
          userId={userId}
          targetDisplayName={targetDisplayName}
          setIsOpen={setIsOpen}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function TransferOrganizationOwnershipForm({
  accountId,
  userId,
  targetDisplayName,
  setIsOpen,
}: {
  userId: string;
  accountId: string;
  targetDisplayName: string;
  setIsOpen: (isOpen: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<boolean>();

  const form = useForm({
    resolver: zodResolver(TransferOwnershipConfirmationSchema),
    defaultValues: {
      confirmation: '',
      accountId,
      userId,
    },
  });

  return (
    <Form {...form}>
      <form
        className={'flex flex-col space-y-4 text-sm'}
        onSubmit={form.handleSubmit((data) => {
          startTransition(async () => {
            try {
              await transferOwnershipAction(data);

              setIsOpen(false);
            } catch {
              setError(true);
            }
          });
        })}
      >
        <If condition={error}>
          <TransferOwnershipErrorAlert />
        </If>

        <p>
          <Trans
            i18nKey={'budgets:transferOwnershipDisclaimer'}
            values={{
              member: targetDisplayName,
            }}
            components={{ b: <b /> }}
          />
        </p>

        <FormField
          name={'confirmation'}
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>
                  <Trans i18nKey={'budgets:transferOwnershipInputLabel'} />
                </FormLabel>

                <FormControl>
                  <Input
                    autoComplete={'off'}
                    type={'text'}
                    required
                    {...field}
                  />
                </FormControl>

                <FormDescription>
                  <Trans i18nKey={'budgets:transferOwnershipInputDescription'} />
                </FormDescription>

                <FormMessage />
              </FormItem>
            );
          }}
        />

        <div>
          <p className={'text-muted-foreground'}>
            <Trans i18nKey={'common:modalConfirmationQuestion'} />
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>
            <Trans i18nKey={'common:cancel'} />
          </AlertDialogCancel>

          <Button
            type={'submit'}
            data-test={'confirm-transfer-ownership-button'}
            variant={'destructive'}
            disabled={pending}
          >
            <If
              condition={pending}
              fallback={<Trans i18nKey={'budgets:transferOwnership'} />}
            >
              <Trans i18nKey={'budgets:transferringOwnership'} />
            </If>
          </Button>
        </AlertDialogFooter>
      </form>
    </Form>
  );
}

function TransferOwnershipErrorAlert() {
  return (
    <Alert variant={'destructive'}>
      <AlertTitle>
        <Trans i18nKey={'budgets:transferTeamErrorHeading'} />
      </AlertTitle>

      <AlertDescription>
        <Trans i18nKey={'budgets:transferTeamErrorMessage'} />
      </AlertDescription>
    </Alert>
  );
}
