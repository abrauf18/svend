'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@kit/ui/button';
import { Trans } from '@kit/ui/trans';
import { useOnboardingContext } from '@kit/accounts/components';
import { usePlaidLink, PlaidLinkOptions } from 'react-plaid-link';

export function ConnectPlaidAccountsButton({ redirectType = 'account', disabled = false }) {
	const { state, accountPlaidConnItemAddOne } = useOnboardingContext();
	const [linkToken, setLinkToken] = useState<string | null>(null);

	const onSuccess = React.useCallback(async (public_token: string, metadata: any) => {
		try {
			const response = await fetch('/api/onboarding/account/plaid/item', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					budgetId: state?.account.budget?.id,
					plaidPublicToken: public_token,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				console.error('Failed to complete Plaid onboarding:', errorData);
				throw new Error(`Failed to complete Plaid onboarding: ${response.status} ${response.statusText}`);
			}

			const result = await response.json();
			console.log('Plaid onboarding successful:', result);

			// Update the state with the returned plaidConnectionItem
			accountPlaidConnItemAddOne(result.plaidConnectionItem);
		} catch (error) {
			console.error('Error during Plaid onboarding:', error);
		}
	}, []);

	const config: PlaidLinkOptions = {
		token: linkToken!,
		onSuccess: onSuccess
	};

	const { open, ready } = usePlaidLink(config);

	useEffect(() => {
		if (ready) {
			open();
		}
	}, [ready]);

	// create link token
	const createLinkToken = async () => {
		if (!state?.account.budget?.id) {
			console.error('Budget ID not found');
			return;
		}
		try {
			const response = await fetch('/api/plaid/create-link-token', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ budgetId: state?.account.budget?.id, redirectType: redirectType }),
			});

			if (!response.ok) {
				const errorData = await response.json();
				console.error('Failed to create Plaid link token:', errorData);
				throw new Error(`Failed to create Plaid link token: ${response.status} ${response.statusText}`);
			}

			const { link_token } = await response.json();
			setLinkToken(link_token);
		} catch (error) {
			console.error('Error creating link token:', error);
		}
	};

	return (
		<Button onClick={() => createLinkToken()} disabled={disabled}>
			<Trans i18nKey={'onboarding:connectAccountsButtonLabel'} />
		</Button>
	);
}
