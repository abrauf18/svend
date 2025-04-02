
import { AppLogo } from '~/components/app-logo';
import { ProfileAccountDropdownContainer } from './personal-account-dropdown-container';

// home imports
import { type UserWorkspace } from '../_lib/server/load-user-workspace';

export function HomeMenuNavigation(props: { workspace: UserWorkspace }) {
  const { workspace, user, accounts } = props.workspace;

  return (
    <div className={'flex w-full flex-1 justify-between'}>
      <div className={'flex items-center space-x-8'}>
        <AppLogo />
      </div>

      <div className={'flex justify-end space-x-2.5'}>
        <ProfileAccountDropdownContainer
          collapsed={true}
          user={user}
          account={workspace}
        />
      </div>
    </div>
  );
}
