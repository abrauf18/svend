'use client';

import React from 'react';
import { Button } from '@kit/ui/button';
import { Trans } from '@kit/ui/trans';

export function ConnectPlaidAccountsButton({ onClick, disabled = false }: { onClick: () => void, disabled?: boolean }) {
	return (
		<Button onClick={onClick} disabled={disabled}>
			<Trans i18nKey={'onboarding:connectAccountsButtonLabel'} />
		</Button>
	);
}
