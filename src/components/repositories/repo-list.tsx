'use client';

import { useState } from 'react';
import { LayoutGrid, List, FolderGit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { RepoCardSkeleton } from '@/components/shared/skeletons';
import { RepoCard } from './repo-card';
import { AddRepoDialog } from './add-repo-dialog';
import type { RepoWithStatus } from '@/hooks/use-repos';

type ViewMode = 'grid' | 'list';

const STORAGE_KEY = 'repo-view-mode';

interface RepoListProps {
  repos: RepoWithStatus[];
  isLoading: boolean;
  onAdd: (fullName: string) => Promise<void>;
  onReindex: (id: string) => void;
  onDelete: (id: string) => void;
}

function getInitialViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'grid';
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'grid' || stored === 'list' ? stored : 'grid';
}

export function RepoList({ repos, isLoading, onAdd, onReindex, onDelete }: RepoListProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);

  function toggleView(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-medium">Repositories</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <RepoCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-medium">Repositories</h1>
          <AddRepoDialog onAdd={onAdd} />
        </div>
        <EmptyState
          icon={FolderGit2}
          heading="No repositories yet"
          description="Add your first repository to get started using the button above."
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-medium">Repositories</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border p-0.5">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon-xs"
              onClick={() => toggleView('grid')}
              aria-label="Grid view"
            >
              <LayoutGrid className="size-3.5" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon-xs"
              onClick={() => toggleView('list')}
              aria-label="List view"
            >
              <List className="size-3.5" />
            </Button>
          </div>
          <AddRepoDialog onAdd={onAdd} />
        </div>
      </div>
      <div
        className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'flex flex-col gap-2'
        }
      >
        {repos.map((repo) => (
          <RepoCard
            key={repo.id}
            repo={repo}
            onReindex={onReindex}
            onDelete={onDelete}
            viewMode={viewMode}
          />
        ))}
      </div>
    </div>
  );
}
