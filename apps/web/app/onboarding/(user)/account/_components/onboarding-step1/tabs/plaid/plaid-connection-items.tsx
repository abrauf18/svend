'use client';

import React, { useLayoutEffect, useEffect, useState } from 'react';
import { useOnboardingContext } from '@kit/accounts/components';
import { Card } from '@kit/ui/card';
import Image from 'next/image';
import { Building } from 'lucide-react';
import { ItemDeleteDialog } from './plaid-item-delete-dialog';
import { Switch } from '@kit/ui/switch';
import { PlaidConnectionItemsSkeleton } from './plaid-connection-items-skeleton';
import { toast } from 'sonner';
import { LoadingOverlay } from '@kit/ui/loading-overlay';

interface PlaidConnectionItemsProps {
    loadingPlaidOAuth?: boolean;
    loadingServer?: boolean;
    setLoadingServer: (loading: boolean) => void;
    headerContent?: React.ReactNode;
}

export function PlaidConnectionItems({ 
    loadingPlaidOAuth = false, 
    loadingServer = false,
    setLoadingServer,
    headerContent 
}: PlaidConnectionItemsProps) {
    const [showLoading, setShowLoading] = useState(false);

    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (loadingServer) {
            timeout = setTimeout(() => {
                setShowLoading(true);
            }, 500);
        } else {
            setShowLoading(false);
        }
        return () => clearTimeout(timeout);
    }, [loadingServer]);

    const { state, accountPlaidConnItemRemoveOne, accountPlaidItemAccountUnlinkOne, accountPlaidItemAccountLinkOne } = useOnboardingContext();

    const handleDeleteItem = async (svendItemId: string) => {
        try {
            await apiCallDeletePlaidConnectionItem(svendItemId);
            accountPlaidConnItemRemoveOne(svendItemId);
        } catch (error) {
            throw error; // This will be caught by the dialog component
        }
    };

    const handleLinkAccountToggle = async (svendItemId: string, svendPlaidAccountId: string, isLinked: boolean) => {
        console.log('handleLinkAccountToggle', svendItemId, svendPlaidAccountId, isLinked);

        // Optimistically update the UI
        if (!isLinked) {
            accountPlaidItemAccountUnlinkOne(svendItemId, svendPlaidAccountId);
        } else {
            accountPlaidItemAccountLinkOne(svendItemId, svendPlaidAccountId, 'pending');
        }

        setLoadingServer(true);

        try {
            if (!isLinked) {
                await apiCallUnlinkPlaidAccount(svendItemId, svendPlaidAccountId);
            } else {
                const result = await apiCallLinkPlaidAccount(svendItemId, svendPlaidAccountId);
                // Update with actual budgetFinAccountId
                accountPlaidItemAccountLinkOne(svendItemId, svendPlaidAccountId, result.budgetFinAccountId);
            }
        } catch (error) {
            // Revert the optimistic update on error
            if (!isLinked) {
                accountPlaidItemAccountLinkOne(svendItemId, svendPlaidAccountId, 'reverted');
            } else {
                accountPlaidItemAccountUnlinkOne(svendItemId, svendPlaidAccountId);
            }
            toast.error('Failed to update account connection');
        } finally {
            setLoadingServer(false);
        }
    };

    // Function to perform the API call for unlinking a Plaid account
    async function apiCallUnlinkPlaidAccount(svendItemId: string, svendPlaidAccountId: string) {
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
      return result;
    }

    // Function to perform the API call for linking a Plaid account
    async function apiCallLinkPlaidAccount(svendItemId: string, svendPlaidAccountId: string) {
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
      return result;
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

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const isAtTop = target.scrollTop <= 1;
        const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
        
        requestAnimationFrame(() => {
            target.style.setProperty('--mask-top', isAtTop ? '0' : '20px');
            target.style.setProperty('--mask-bottom', distanceFromBottom <= 1 ? '0' : '20px');
        });
    };

    useEffect(() => {
        const container = document.querySelector('.plaid-items-scroll-container') as HTMLElement;
        if (container) {
            container.style.setProperty('--mask-top', '0');
            container.style.setProperty('--mask-bottom', '20px');
        }
    }, []);

    useEffect(() => {
        if (loadingPlaidOAuth) {
            // Wait for next frame to ensure skeleton is rendered
            requestAnimationFrame(() => {
                // Add a small delay for smoother transition
                setTimeout(() => {
                    const skeletonElement = document.querySelector('.plaid-connection-skeleton');
                    if (skeletonElement) {
                        skeletonElement.scrollIntoView({ 
                            behavior: 'smooth',
                            block: 'end'
                        });
                    }
                }, 100);
            });
        }
    }, [loadingPlaidOAuth]);

    return (
        <div className="h-full w-full">
            {showLoading && (
                <LoadingOverlay
                    displayLogo={false}
                    fullPage={true}
                    className="!bg-background/50"
                />
            )}
            <div className="h-full w-[432px]">
                <div 
                    onScroll={handleScroll}
                    className="plaid-items-scroll-container h-[calc(97vh-430px)] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 pr-4 [mask-image:linear-gradient(to_bottom,transparent,black_var(--mask-top,20px),black_calc(100%-20px),transparent)]"
                >
                    <div className="flex flex-col gap-2 pb-6">
                        {headerContent}
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
                                        <Card
                                            key={plaidItemAccount.svendAccountId}
                                            className="flex items-center justify-between p-4 w-full max-w-xl border border-gray-600 mt-3"
                                        >
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
                                                    <h2 className="text-xl font-semibold text-primary-800">{plaidItemAccount.accountName}</h2>
                                                    <div className="flex items-center gap-1 text-left text-sm text-primary/70">
                                                        <span className="block max-w-[15ch] overflow-hidden text-ellipsis whitespace-nowrap capitalize">
                                                            {plaidItemAccount.accountType}
                                                        </span>{' '}
                                                        &middot; <span>****{plaidItemAccount.mask}</span>
                                                    </div>
                                                    <div className="text-sm text-muted-foreground mt-1">
                                                        ${plaidItemAccount.balanceCurrent?.toLocaleString('en-US', {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2
                                                        }) ?? '0.00'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pl-4">
                                                <Switch
                                                    checked={!!plaidItemAccount.budgetFinAccountId}
                                                    onCheckedChange={(e) => handleLinkAccountToggle(plaidItem.svendItemId, plaidItemAccount.svendAccountId, e.valueOf())}
                                                />
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {loadingPlaidOAuth && (
                            <div>
                                <PlaidConnectionItemsSkeleton className="plaid-connection-skeleton" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
