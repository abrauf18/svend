'use client';

import React, { useState, useEffect } from 'react';
import { useOnboardingContext } from '@kit/accounts/components';
import { Card } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Building } from 'lucide-react';

export function PlaidConnectionItems() {
    const supabase = useSupabase();

    const { state, accountPlaidConnItemAccountRemoveOne } = useOnboardingContext();

    const hasOneAccountRemaining = (svendItemId: string) => {
        return state.account.plaidConnectionItems?.find((item) => item.svendItemId === svendItemId)?.itemAccounts?.length === 1;
    }

    const handleDeleteAccountClick = async (svendItemId: string, svendPlaidAccountId: string) => {
        // Check if this is the last account
        if (state.account.plaidConnectionItems?.find((item) => item.svendItemId === svendItemId)?.itemAccounts?.length === 1) {
            // If it's the last account, don't delete
            console.warn("can't delete the last account, at least one account must remain connected");
            return;
        }

        try {
            const response = await fetch('/api/onboarding/account/plaid/item', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    svendPlaidAccountId: svendPlaidAccountId,
                    action: 'remove_account'
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Failed to remove Plaid account:', errorData);
                throw new Error(`Failed to remove Plaid account: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Plaid account removed successfully:', result);

            // If the API call is successful, update the local state
            accountPlaidConnItemAccountRemoveOne(svendItemId, svendPlaidAccountId);
        } catch (error) {
            console.error('Error removing Plaid account:', error);
            // You might want to show an error message to the user here
            return;
        }
    };

    return (
        <div className="w-full max-w-md p-4 pl-0">
            {state.account.plaidConnectionItems?.map((plaidItem) => (
                <div key={plaidItem.plaidItemId} className="mb-4 border border-primary rounded-lg space-y-4 p-6">
                    <div className="flex items-center justify-between p-4 border border-gray-600 rounded-lg">
                        <span className="font-semibold text-[16px] underline">{plaidItem.institutionName}</span>
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
                                        <p className="text-sm text-primary-600">{plaidItemAccount.accountName} - *{plaidItemAccount.mask}</p>
                                    </div>
                                </div>
                                <div className="pl-4">
                                    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => handleDeleteAccountClick(plaidItem.svendItemId, plaidItemAccount.svendAccountId)} disabled={hasOneAccountRemaining(plaidItem.svendItemId)}>
                                        <Trash2 className="h-6 w-6" />
                                        <span className="sr-only">Delete account</span>
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
