import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@kit/ui/dialog';
import { Button } from '@kit/ui/button';
import { PlusCircle } from 'lucide-react';
import { Trans } from '@kit/ui/trans';
import { AccountMembersTable, InviteMembersDialogContainer } from '@kit/team-accounts/components';
import { loadMembersPageData } from '../members/_lib/server/members-page.loader';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { InviteMembersDialog } from './invite-members-dialog';
import { withI18n } from '~/lib/i18n/with-i18n';
import { useBudgetWorkspace } from '~/components/budget-workspace-context';

interface FirstTimeInviteMembersModalProps {
  params: {
    accountSlug: string;
  };
}

async function FirstTimeInviteMembersModal({ params }: FirstTimeInviteMembersModalProps) {
  const supabase = getSupabaseServerClient();

  const [members, invitations, canAddMember, { user, account }] =
    await loadMembersPageData(supabase, params.accountSlug);

  const budgetId = account.budget_id;

  const canManageRoles = account.permissions.includes('roles.manage');
  const canManageInvitations = account.permissions.includes('invites.manage');

  const isPrimaryOwner = account.primary_owner_user_id === user.id;
  const currentUserRoleHierarchy = account.role_hierarchy_level;

  return (
    <InviteMembersDialog 
      budgetId={budgetId!}
    >
      <DialogHeader>
        <DialogTitle>
          <Trans i18nKey={'common:accountMembers'} />
        </DialogTitle>
        <DialogDescription>
          <Trans i18nKey={'common:membersTabDescription'} />
        </DialogDescription>
      </DialogHeader>

      <div className="flex justify-end mb-4">
        {canManageInvitations && (await canAddMember()) && (
          <InviteMembersDialogContainer
            userRoleHierarchy={currentUserRoleHierarchy}
            accountSlug={params.accountSlug}
          >
            <Button size={'sm'} data-test={'invite-members-form-trigger'}>
              <PlusCircle className={'mr-2 w-4'} />
              <span>
                <Trans i18nKey={'teams:inviteMembersButton'} />
              </span>
            </Button>
          </InviteMembersDialogContainer>
        )}
      </div>

      <AccountMembersTable
        userRoleHierarchy={currentUserRoleHierarchy}
        currentUserId={user.id}
        currentAccountId={account.id}
        members={members}
        isPrimaryOwner={isPrimaryOwner}
        canManageRoles={canManageRoles}
      />
    </InviteMembersDialog>
  );
}

export default withI18n(FirstTimeInviteMembersModal);
