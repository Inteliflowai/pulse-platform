'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { AssetsTab } from './assets-tab';
import { PackagesTab } from './packages-tab';
import { SyncJobsTab } from './sync-jobs-tab';

const tabs = [
  { key: 'assets', label: 'Assets' },
  { key: 'packages', label: 'Packages' },
  { key: 'sync', label: 'Sync Jobs' },
] as const;

type TabKey = (typeof tabs)[number]['key'];

export default function ContentPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('assets');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Content Management</h1>

      {/* Tab bar */}
      <div className="flex border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.key
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'assets' && <AssetsTab />}
      {activeTab === 'packages' && <PackagesTab />}
      {activeTab === 'sync' && <SyncJobsTab />}
    </div>
  );
}
