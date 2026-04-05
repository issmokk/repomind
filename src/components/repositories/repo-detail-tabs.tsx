'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { OverviewTab } from './overview-tab';
import { SettingsTab } from './settings-tab';
import { IndexingTab } from './indexing-tab';
import { LinkedReposTab } from './linked-repos-tab';
import type { Repository, RepositorySettings } from '@/types/repository';
import type { IndexingJob } from '@/types/indexing';
import type { KeyedMutator } from 'swr';

interface RepoDetailTabsProps {
  repo: Repository;
  settings: RepositorySettings | undefined;
  latestJob: IndexingJob | null;
  mutateRepo: KeyedMutator<Repository>;
  mutateSettings: KeyedMutator<RepositorySettings | null>;
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
        <TabsTrigger value="linked">Linked Repos</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <OverviewTab repo={repo} latestJob={latestJob} mutateRepo={mutateRepo} mutateJob={mutateJob} />
      </TabsContent>
      <TabsContent value="indexing">
        <IndexingTab repoId={repo.id} initialJob={latestJob} hasLastIndexedCommit={!!repo.lastIndexedCommit} />
      </TabsContent>
      <TabsContent value="settings">
        {settings ? (
          <SettingsTab repoId={repo.id} settings={settings} mutateSettings={mutateSettings} />
        ) : (
          <p className="py-4 text-sm text-muted-foreground">No settings configured yet. Settings will be created when indexing starts.</p>
        )}
      </TabsContent>
      <TabsContent value="linked">
        <LinkedReposTab repoId={repo.id} />
      </TabsContent>
    </Tabs>
  );
}
