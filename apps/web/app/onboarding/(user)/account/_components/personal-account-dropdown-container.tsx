'use client';

import type { User } from '@supabase/supabase-js';

import { PersonalAccountDropdown } from './personal-account-dropdown';
import { useSignOut } from '@kit/supabase/hooks/use-sign-out';
import { useUser } from '@kit/supabase/hooks/use-user';

export function ProfileAccountDropdownContainer(props: {
  collapsed: boolean;
  user: User;

  account?: {
    id: string | null;
    name: string | null;
    picture_url: string | null;
  };
}) {
  const signOut = useSignOut();
  const user = useUser(props.user);
  const userData = user.data as User;

  return (
    <div className={props.collapsed ? '' : 'w-full'}>
      <PersonalAccountDropdown
        className={'w-full'}
        user={userData}
        showProfileName={!props.collapsed}
        account={props.account}
        signOutRequested={() => signOut.mutateAsync()}
      />
    </div>
  );
}
