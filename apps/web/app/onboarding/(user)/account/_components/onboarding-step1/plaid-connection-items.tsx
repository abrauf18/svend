'use client';

import React, { useLayoutEffect } from 'react';
import { useOnboardingContext } from '@kit/accounts/components';
import { Card } from '@kit/ui/card';
import Image from 'next/image';
import { Building } from 'lucide-react';
import { ItemDeleteDialog } from './plaid-item-delete-dialog';
import { Switch } from '@kit/ui/switch';
import { PlaidConnectionItemsSkeleton } from './plaid-connection-items-skeleton';

interface PlaidConnectionItemsProps {
    loadingPlaidOAuth?: boolean;
    loadingServer?: boolean;
    setLoadingPlaidOAuth: (loading: boolean) => void;
    setLoadingServer: (loading: boolean) => void;
}

export function PlaidConnectionItems({ 
    loadingPlaidOAuth = false, 
    loadingServer = false, 
    setLoadingPlaidOAuth,
    setLoadingServer 
}: PlaidConnectionItemsProps) {

    const { state, accountPlaidConnItemRemoveOne, accountPlaidItemAccountUnlinkOne, accountPlaidItemAccountLinkOne } = useOnboardingContext();

    useLayoutEffect(() => {
        if (loadingPlaidOAuth) {
            const skeletonElement = document.querySelector('.plaid-connection-skeleton');
            if (skeletonElement) {
                skeletonElement.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, [loadingPlaidOAuth]);

    const handleDeleteItem = async (svendItemId: string) => {
        try {
            await apiCallDeletePlaidConnectionItem(svendItemId);
            accountPlaidConnItemRemoveOne(svendItemId);
        } catch (error) {
            throw error; // This will be caught by the dialog component
        }
    };

    const getLastLinkedItemAccountId = (svendItemId: string): string | null => {
        const linkedAccounts = state.account.plaidConnectionItems
            ?.find((item) => item.svendItemId === svendItemId)
            ?.itemAccounts.filter((account) => !!account.budgetFinAccountId);

        return linkedAccounts?.length === 1 ? linkedAccounts[0]?.svendAccountId as string : null;
    }

    const handleLinkAccountToggle = async (svendItemId: string, svendPlaidAccountId: string, isLinked: boolean) => {
        console.log('handleLinkAccountToggle', svendItemId, svendPlaidAccountId, isLinked);

        if (getLastLinkedItemAccountId(svendItemId) === svendPlaidAccountId) {
            console.warn("can't unlink the last account, at least one account must remain connected");
            return;
        }

        if (!isLinked) {
            await apiCallUnlinkPlaidAccount(svendItemId, svendPlaidAccountId);
        } else {
            await apiCallLinkPlaidAccount(svendItemId, svendPlaidAccountId);
        }
    }

    // Function to perform the API call for unlinking a Plaid account
    async function apiCallUnlinkPlaidAccount(svendItemId: string, svendPlaidAccountId: string) {
        try {
            const response = await fetch('/api/onboarding/account/budget/plaid/accounts', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    svendPlaidAccountId: svendPlaidAccountId,
                    action: 'unlink_account'
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Failed to unlink Plaid account:', errorData);
                throw new Error(`Failed to unlink Plaid account: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Plaid account unlinked successfully:', result);

            // If the API call is successful, update the local state
            accountPlaidItemAccountUnlinkOne(svendItemId, svendPlaidAccountId);
        } catch (error) {
            console.error('Error unlinking Plaid account:', error);
            // You might want to show an error message to the user here
        }
    }

    // Function to perform the API call for linking a Plaid account
    async function apiCallLinkPlaidAccount(svendItemId: string, svendPlaidAccountId: string) {
        try {
            const response = await fetch('/api/onboarding/account/budget/plaid/accounts', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    svendPlaidAccountId: svendPlaidAccountId,
                    action: 'link_account'
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Failed to link Plaid account:', errorData);
                throw new Error(`Failed to link Plaid account: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Plaid account linked successfully:', result);

            // If the API call is successful, update the local state
            accountPlaidItemAccountLinkOne(svendItemId, svendPlaidAccountId, result.budgetFinAccountId);
        } catch (error) {
            console.error('Error linking Plaid account:', error);
            // You might want to show an error message to the user here
        }
    }

    // Function to perform the API call
    const apiCallDeletePlaidConnectionItem = async (svendItemId: string) => {
        try {
            const response = await fetch('/api/onboarding/account/plaid/item', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ svendItemId }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Failed to delete Plaid connection item:', errorData);
                throw new Error(`Failed to delete Plaid connection item: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Plaid connection item deleted successfully:', result);

            // Update local state or perform any additional actions here
        } catch (error) {
            console.error('Error deleting Plaid connection item:', error);
            throw error;
        }
    }

    return (
        <div className="w-full max-w-md p-4 pl-0">
            {state.account.plaidConnectionItems?.map((plaidItem) => (
                <div key={plaidItem.svendItemId} className="mb-4 border border-primary rounded-lg space-y-4 p-6">
                    <div className="flex items-center justify-between p-4 border border-gray-600 rounded-lg">
                        <span className="font-semibold text-[16px] underline">{plaidItem.institutionName}</span>
                        <ItemDeleteDialog 
                            onConfirm={() => handleDeleteItem(plaidItem.svendItemId)} 
                        />
                    </div>
                    <div className="pl-4 mt-2">
                        {plaidItem.itemAccounts?.map((plaidItemAccount) => (
                            <Card key={plaidItemAccount.svendAccountId} className="flex items-center justify-between p-4 w-full max-w-xl border border-gray-600 mt-3">
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 flex items-center justify-center bg-primary rounded">
                                        {plaidItem.institutionLogoSignedUrl ? (
                                            <Image
                                                src={plaidItem.institutionLogoSignedUrl}
                                                alt={`${plaidItem.institutionName} logo`}
                                                width={48}
                                                height={48}
                                                className="rounded"
                                            />
                                        ) : (
                                            <Building className="h-8 w-8 text-black" />
                                        )}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-semibold text-primary-800">{plaidItem.institutionName}</h2>
                                        <p className="text-sm text-primary-600">{plaidItemAccount.accountName} - ***{plaidItemAccount.mask}</p>
                                    </div>
                                </div>
                                <div className="pl-4">
                                    <Switch
                                        checked={!!plaidItemAccount.budgetFinAccountId}
                                        onCheckedChange={(e) => handleLinkAccountToggle(plaidItem.svendItemId, plaidItemAccount.svendAccountId, e.valueOf())}
                                        disabled={getLastLinkedItemAccountId(plaidItem.svendItemId) === plaidItemAccount.svendAccountId}
                                    />
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            ))}
            {loadingPlaidOAuth && <PlaidConnectionItemsSkeleton className="plaid-connection-skeleton" />}
        </div>
    );
}
