'use client';
import React, { useState } from 'react';
import { ConnectPlaidAccountsButton } from './connect-plaid-accounts-button';
import { useFinAccountsMgmtContext } from '~/components/fin-accounts-mgmt-context';
import { Card } from '@kit/ui/card';
import { Building, CreditCard, Wallet, ChevronDown, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Switch } from '@kit/ui/switch';
import { Budget } from '~/lib/model/budget.types';
import { FinAccountsMgmtPlaidItemAccount } from '~/lib/model/fin-accounts-mgmt.types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@kit/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { toast } from 'sonner';

function PlaidTabMgmt() {
  const { state, accountPlaidItemAccountLinkOne, accountPlaidItemAccountUnlinkOne, accountPlaidConnItemRemoveOne } = useFinAccountsMgmtContext();
  const plaidItems = state.account.plaidConnectionItems ?? [];
  const budgets = state.account.budgets ?? [];
  const [loadingAccount, setLoadingAccount] = useState<string | null>(null);
  const [disconnectingItem, setDisconnectingItem] = useState<string | null>(null);
  
  const handleBudgetToggle = async (
    account: FinAccountsMgmtPlaidItemAccount,
    budget: Budget,
    checked: boolean
  ) => {
    try {
      if (!checked) {
        // Check if the account is linked to a goal in this specific budget
        const linkedGoals = budget.goals?.filter(goal => 
          goal.plaidAccountId === account.svendAccountId
        ) ?? [];
        
        if (linkedGoals.length > 0) {
          toast.error(`You cannot unlink the account "${account.accountName}" because it is currently associated with one or more goals in this budget.`);
          return;
        }
      }

      setLoadingAccount(account.svendAccountId);

      if (checked) {
        // 1. Re-sync transactions
        const plaidItem = plaidItems.find(item => item.svendItemId === account.svendItemId);
        if (plaidItem) {
          const syncToastId = toast.loading('Checking for new transactions...');
          
          const syncResponse = await fetch('/api/fin-account-mgmt/plaid/sync-transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plaidConnectionItem: {
                svendItemId: plaidItem.svendItemId
              }
            }),
          });

          if (!syncResponse.ok) {
            toast.dismiss(syncToastId);
            const errorData = await syncResponse.json();
            console.error('Sync error:', errorData);
            throw new Error(`Failed to sync transactions: ${JSON.stringify(errorData)}`);
          }
          toast.dismiss(syncToastId);
        }

        // 2. Link account to budget
        const response = await fetch('/api/fin-account-mgmt/plaid/account/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plaidAccountId: account.svendAccountId,
            budgetId: budget.id
          })
        });

        if (!response.ok) throw new Error('Failed to link account');
        
        const { budgetFinAccountId } = await response.json();
        accountPlaidItemAccountLinkOne(
          account.svendItemId,
          account.svendAccountId,
          budget.id,
          budgetFinAccountId
        );
      } else {
        // Unlink account from budget
        const response = await fetch('/api/fin-account-mgmt/plaid/account/link', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plaidAccountId: account.svendAccountId,
            budgetId: budget.id
          })
        });

        if (!response.ok) throw new Error('Failed to unlink account');

        accountPlaidItemAccountUnlinkOne(
          account.svendItemId,
          account.svendAccountId
        );
      }
    } catch (error) {
      console.error('Error toggling budget link:', error);
      toast.error('Error connecting account to budget. Please try again.');
    } finally {
      setLoadingAccount(null);
    }
  };

  const handleDisconnectInstitution = async (svendItemId: string) => {
    const accountsInItem = plaidItems
      .find(item => item.svendItemId === svendItemId)
      ?.itemAccounts ?? [];
    
    const linkedGoals = budgets.flatMap(b => b.goals?.filter(goal => 
      accountsInItem.some(account => account.svendAccountId === goal.plaidAccountId)
    )) ?? [];
    
    if (linkedGoals.length > 0) {
      const accountsWithGoals = accountsInItem.filter(account => 
        linkedGoals.some(goal => goal.plaidAccountId === account.svendAccountId)
      );
      
      const accountNames = accountsWithGoals.map(account => account.accountName).join(', ');
      
      toast.error(`You cannot disconnect this institution because the account "${accountNames}" is currently associated with one or more goals in a linked budget.`);
      return;
    }
    
    try {
      setDisconnectingItem(svendItemId);
      const disconnectToastId = toast.loading('Disconnecting institution...');
      
      const response = await fetch(`/api/fin-account-mgmt/plaid/item`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ svendItemId })
      });

      toast.dismiss(disconnectToastId);

      if (!response.ok) throw new Error('Failed to disconnect institution');

      // Update state
      accountPlaidConnItemRemoveOne(svendItemId);
      toast.success('Institution disconnected successfully');

    } catch (error) {
      console.error('Error disconnecting institution:', error);
      toast.error('Error disconnecting institution. Please try again.');
    } finally {
      setDisconnectingItem(null);
    }
  };

  return (
    <div className="flex-grow space-y-4">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-semibold">Connected Banks</h2>
        <ConnectPlaidAccountsButton />
      </div>

      <div className="grid grid-cols-1 gap-8">
        {plaidItems.map((item) => (
          <Card key={item.svendItemId} className="p-6">
            {/* Cabecera de la institución */}
            <div className="flex items-center justify-between pb-6 border-b">
              <div className="flex items-center gap-3">
                {item.institutionLogoSignedUrl ? (
                  <Image
                    src={item.institutionLogoSignedUrl}
                    alt={`${item.institutionName} logo`}
                    width={40}
                    height={40}
                    className="rounded"
                  />
                ) : (
                  <Building className="h-10 w-10" />
                )}
                <h3 className="text-xl font-semibold">{item.institutionName}</h3>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect Institution</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to disconnect {item.institutionName}? This will remove all linked accounts and their transaction history. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={disconnectingItem === item.svendItemId}
                      onClick={() => handleDisconnectInstitution(item.svendItemId)}
                    >
                      {disconnectingItem === item.svendItemId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Disconnect'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Lista de cuentas */}
            <div className="space-y-4 mt-6">
              {item.itemAccounts.map((account) => (
                <div
                  key={account.svendAccountId}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/10 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {account.accountType === 'credit' ? (
                      <CreditCard className="h-5 w-5 text-primary" />
                    ) : (
                      <Wallet className="h-5 w-5 text-primary" />
                    )}
                    
                    <div>
                      <div className="font-medium">{account.accountName}</div>
                      <div className="text-sm text-muted-foreground">
                        <span className="capitalize">{account.accountType}</span> • ****{account.mask}
                      </div>
                      <div className="text-sm font-medium mt-1">
                        ${account.balanceCurrent.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </div>
                      {account.budgetFinAccountIds?.length > 0 && (
                        <div className="mt-2">
                          <div className="text-sm text-muted-foreground">
                            Connected Budgets: <span className="font-medium">{account.budgetFinAccountIds.length}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          Manage Budgets
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[200px] p-2">
                        <div className="space-y-2">
                          {budgets.map((budget) => (
                            <div key={budget.id} className="flex items-center justify-between px-2 py-1.5">
                              <span className="text-sm">{budget.name}</span>
                              <div className="flex items-center gap-2">
                                {loadingAccount === account.svendAccountId ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Switch 
                                    checked={account.budgetFinAccountIds?.some(id => 
                                      budget.linkedFinAccounts?.some(acc => acc.budgetFinAccountId === id)
                                    )}
                                    onCheckedChange={(checked) => {
                                      console.log('Account:', account);
                                      console.log('Budget:', budget);
                                      console.log('budgetFinAccountIds:', account.budgetFinAccountIds);
                                      console.log('linkedFinAccounts:', budget.linkedFinAccounts);
                                      handleBudgetToggle(account, budget, checked);
                                    }}
                                  />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {plaidItems.length === 0 && (
        <Card className="p-8 text-center">
          <Building className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No accounts connected</h3>
          <p className="text-muted-foreground mb-6">
            Connect your bank accounts to get started with managing your finances.
          </p>
        </Card>
      )}
    </div>
  );
}

export default PlaidTabMgmt;