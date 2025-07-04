import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
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
import { Trans } from '@kit/ui/trans';

import { RoleSchema } from '../../schema/update-member-role.schema';
import { updateMemberRoleAction } from '../../server/actions/team-members-server-actions';
import { MembershipRoleSelector } from './membership-role-selector';
import { RolesDataProvider } from './roles-data-provider';

type Role = string;

export function UpdateMemberRoleDialog({
  isOpen,
  setIsOpen,
  userId,
  teamAccountId,
  userRole,
  userRoleHierarchy,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  userId: string;
  teamAccountId: string;
  userRole: Role;
  userRoleHierarchy: number;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans i18nKey={'budgets:updateMemberRoleModalHeading'} />
          </DialogTitle>

          <DialogDescription>
            <Trans i18nKey={'budgets:updateMemberRoleModalDescription'} />
          </DialogDescription>
        </DialogHeader>

        <RolesDataProvider maxRoleHierarchy={userRoleHierarchy}>
          {(data) => (
            <UpdateMemberForm
              setIsOpen={setIsOpen}
              userId={userId}
              teamAccountId={teamAccountId}
              userRole={userRole}
              roles={data}
            />
          )}
        </RolesDataProvider>
      </DialogContent>
    </Dialog>
  );
}

function UpdateMemberForm({
  userId,
  userRole,
  teamAccountId,
  setIsOpen,
  roles,
}: React.PropsWithChildren<{
  userId: string;
  userRole: Role;
  teamAccountId: string;
  setIsOpen: (isOpen: boolean) => void;
  roles: Role[];
}>) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<boolean>();
  const { t } = useTranslation('budgets');

  const onSubmit = ({ role }: { role: Role }) => {
    startTransition(async () => {
      try {
        await updateMemberRoleAction({
          accountId: teamAccountId,
          userId,
          role,
        });

        setIsOpen(false);
      } catch {
        setError(true);
      }
    });
  };

  const form = useForm({
    resolver: zodResolver(
      RoleSchema.refine(
        (data) => {
          return data.role !== userRole;
        },
        {
          message: t(`roleMustBeDifferent`),
          path: ['role'],
        },
      ),
    ),
    reValidateMode: 'onChange',
    mode: 'onChange',
    defaultValues: {
      role: userRole,
    },
  });

  return (
    <Form {...form}>
      <form
        data-test={'update-member-role-form'}
        onSubmit={form.handleSubmit(onSubmit)}
        className={'flex flex-col space-y-6'}
      >
        <If condition={error}>
          <UpdateRoleErrorAlert />
        </If>

        <FormField
          name={'role'}
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>{t('roleLabel')}</FormLabel>

                <FormControl>
                  <MembershipRoleSelector
                    roles={roles}
                    currentUserRole={userRole}
                    value={field.value}
                    onChange={(newRole) => form.setValue('role', newRole)}
                  />
                </FormControl>

                <FormDescription>{t('updateRoleDescription')}</FormDescription>

                <FormMessage />
              </FormItem>
            );
          }}
        />

        <Button data-test={'confirm-update-member-role'} disabled={pending}>
          <Trans i18nKey={'budgets:updateRoleSubmitLabel'} />
        </Button>
      </form>
    </Form>
  );
}

function UpdateRoleErrorAlert() {
  return (
    <Alert variant={'destructive'}>
      <AlertTitle>
        <Trans i18nKey={'budgets:updateRoleErrorHeading'} />
      </AlertTitle>

      <AlertDescription>
        <Trans i18nKey={'budgets:updateRoleErrorMessage'} />
      </AlertDescription>
    </Alert>
  );
}
