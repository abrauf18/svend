'use client';
import React from 'react';

type Props<TKeys extends string> = {
  tabs: { label: string; key: TKeys; icon?: React.ReactNode }[];
  selectedTab: TKeys;
  setSelectedTab: React.Dispatch<React.SetStateAction<TKeys>>;
};

export default function Tabs<TKeys extends string>({
  tabs,
  selectedTab,
  setSelectedTab,
}: Props<TKeys>) {
  return (
    <div className={`flex w-fit items-center divide-x-2 rounded-md border`}>
      {tabs.map((tab) => (
        <button
          className={`flex items-center gap-2 px-4 py-2 transition-colors duration-200 hover:bg-accent ${selectedTab === tab.key ? '' : 'text-primary/50'}`}
          key={tab.key}
          onClick={() => setSelectedTab(tab.key)}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
