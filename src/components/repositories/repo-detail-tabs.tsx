'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { OverviewTab } from './overview-tab';
import { SettingsTab } from './settings-tab';
import { IndexingTabPlaceholder } from './indexing-tab-placeholder';
import type { Repository, RepositorySettings } from '@/types/repository';
import type { IndexingJob } from '@/types/indexing';
import type { KeyedMutator } from 'swr';

interface RepoDetailTabsProps {
  repo: Repository;
  settings: RepositorySettings;
  latestJob: IndexingJob | null;
  mutateRepo: KeyedMutator<Repository>;
  mutateSettings: KeyedMutator<RepositorySettings>;
  mutateJob: KeyedMutator<IndexingJob | { status: 'none' }>;
}

export function RepoDetailTabs({
  repo,
  settings,
  latestJob,
  mutateRepo,
  mutateSettings,
  mutateJob,
}: RepoDetailTabsProps) {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="indexing">Indexing</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <OverviewTab repo={repo} latestJob={latestJob} mutateRepo={mutateRepo} mutateJob={mutateJob} />
      </TabsContent>
      <TabsContent value="indexing">
        <IndexingTabPlaceholder repoId={repo.id} />
      </TabsContent>
      <TabsContent value="settings">
        <SettingsTab repoId={repo.id} settings={settings} mutateSettings={mutateSettings} />
      </TabsContent>
    </Tabs>
  );
}
