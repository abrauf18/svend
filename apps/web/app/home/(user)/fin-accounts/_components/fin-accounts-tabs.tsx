'use client';

import { useState } from 'react';
import { TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { Tabs } from '@kit/ui/tabs';
import { Trans } from '@kit/ui/trans';
import PlaidTabMgmt from './plaid-tab-mgmt';
import ManualTabMgmt from './manual/manual-tab-mgmt';

export function FinAccountsTabs() {
  const [activeTab, setActiveTab] = useState('plaid');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="h-[58px] w-full bg-background p-1 items-start justify-start">
        <TabsTrigger
          value="plaid"
          className="h-[48px] rounded-md data-[state=active]:bg-green-300 data-[state=active]:text-primary-foreground"
        >
          <Trans i18nKey={'fin-accounts:plaidAccountsTabLabel'} />
        </TabsTrigger>
        <TabsTrigger
          value="manual"
          className="h-[48px] rounded-md data-[state=active]:bg-green-300 data-[state=active]:text-primary-foreground"
        >
          <Trans i18nKey={'fin-accounts:manualAccountsTabLabel'} />
        </TabsTrigger>
      </TabsList>

      <div className="flex-grow space-y-4">
        <TabsContent value="plaid" className="w-full">
          <div className="w-full max-w-[1000px] px-4">
            <PlaidTabMgmt />
          </div>
        </TabsContent>

        <TabsContent value="manual" className="w-full">
          <div className="w-full max-w-[1000px] px-4">
            <ManualTabMgmt />
          </div>
        </TabsContent>
      </div>
    </Tabs>
  );
} 