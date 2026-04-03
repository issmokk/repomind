'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RepoSelectorProps {
  selectedRepoIds: string[];
  onSelectionChange: (repoIds: string[]) => void;
  excludeRepoId?: string;
}

type RepoListItem = { id: string; name: string; fullName: string };

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function RepoSelector({ selectedRepoIds, onSelectionChange, excludeRepoId }: RepoSelectorProps) {
  const [search, setSearch] = useState('');
  const { data: repos, isLoading } = useSWR<RepoListItem[]>('/api/repos', fetcher);

  const filtered = (repos ?? [])
    .filter(r => r.id !== excludeRepoId)
    .filter(r =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.fullName.toLowerCase().includes(search.toLowerCase())
    );

  function toggleRepo(repoId: string) {
    if (selectedRepoIds.includes(repoId)) {
      onSelectionChange(selectedRepoIds.filter(id => id !== repoId));
    } else {
      onSelectionChange([...selectedRepoIds, repoId]);
    }
  }

  return (
    <div className="space-y-2">
      <Input
        placeholder="Search repositories..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <ScrollArea className="h-48 rounded-md border p-2">
        {isLoading && <p className="text-sm text-muted-foreground py-2">Loading...</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">No repositories found</p>
        )}
        {filtered.map(repo => (
          <label
            key={repo.id}
            className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted cursor-pointer"
          >
            <Checkbox
              checked={selectedRepoIds.includes(repo.id)}
              onCheckedChange={() => toggleRepo(repo.id)}
            />
            <span className="text-sm">{repo.fullName}</span>
          </label>
        ))}
      </ScrollArea>
      {selectedRepoIds.length > 0 && (
        <p className="text-xs text-muted-foreground">{selectedRepoIds.length} selected</p>
      )}
    </div>
  );
}
