'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@kit/ui/button';
import { Trans } from '@kit/ui/trans';
import { usePlaidLink, PlaidLinkOptions } from 'react-plaid-link';
import { useFinAccountsMgmtContext } from '~/components/fin-accounts-mgmt-context';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export function ConnectPlaidAccountsButton({ disabled = false }) {
	const { accountPlaidConnItemAddOne } = useFinAccountsMgmtContext();
	const [linkToken, setLinkToken] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isConnecting, setIsConnecting] = useState(false);

	const onSuccess = React.useCallback(async (public_token: string) => {
		try {
			setIsConnecting(true);
			const connectingToastId = toast.loading('Connecting your account...');

			// 1. Create Plaid connection item in the database
			const response = await fetch('/api/fin-account-mgmt/plaid/item', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					plaidPublicToken: public_token,
				}),
			});

			if (!response.ok) {
				toast.dismiss(connectingToastId);
				throw new Error(`Failed to complete Plaid connection: ${response.status}`);
			}

			const result = await response.json();
			accountPlaidConnItemAddOne(result.plaidConnectionItem);
			toast.dismiss(connectingToastId);
			
			if (result.plaidConnectionItem) {
				toast.success('Account connected successfully!');
			}

		} catch (error) {
			console.error('Error during Plaid connection:', error);
			toast.error('Error connecting account. Please try again.');
		} finally {
			setIsConnecting(false);
		}
	}, [accountPlaidConnItemAddOne]);

	const config: PlaidLinkOptions = {
		token: linkToken!,
		onSuccess: onSuccess
	};

	const { open, ready } = usePlaidLink(config);

	useEffect(() => {
		if (ready) {
			open();
			setIsLoading(false);
		}
	}, [ready, open]);

	const handleConnect = async () => {
		setIsLoading(true);
		const initToastId = toast.loading('Preparing connection...');
		
		try {
			const response = await fetch('/api/plaid/create-link-token', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ isOnboarding: false }),
			});

			toast.dismiss(initToastId);

			if (!response.ok) {
				throw new Error(`Error creating connection token: ${response.status}`);
			}

			const { link_token } = await response.json();
			setLinkToken(link_token);
		} catch (error) {
			console.error('Error creating link token:', error);
			toast.error('Error initiating connection. Please try again.');
			setIsLoading(false);
		}
	};

	return (
		<Button 
			onClick={handleConnect} 
			disabled={disabled || isLoading || isConnecting}
		>
			{isLoading || isConnecting ? (
				<>
					<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					{isConnecting ? 'Connecting...' : 'Initializing...'}
				</>
			) : (
				<>
					<Plus className="mr-2 h-4 w-4" />
					<Trans i18nKey="onboarding:connectAccountsButtonLabel">Connect Account</Trans>
				</>
			)}
		</Button>
	);
}

export default ConnectPlaidAccountsButton;
