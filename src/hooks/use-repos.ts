'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import type { Repository } from '@/types/repository';
import type { IndexingJobStatus } from '@/types/indexing';

export type RepoWithStatus = Repository & { latestJobStatus: IndexingJobStatus | null };

export function useRepos() {
  const { data, error, isLoading, mutate } = useSWR<RepoWithStatus[]>('/api/repos', fetcher);

  async function addRepo(fullName: string): Promise<string> {
    const res = await fetch('/api/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to add repository');
    }
    const repo = await res.json();
    await mutate();
    return repo.id;
  }

  async function triggerIndex(repoId: string) {
    const res = await fetch(`/api/repos/${repoId}/index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'manual' }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to start indexing');
    }
  }

  async function deleteRepo(id: string) {
    await mutate(
      async (current) => {
        const res = await fetch(`/api/repos/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete repository');
        return current?.filter((r) => r.id !== id);
      },
      { optimisticData: (current) => current?.filter((r) => r.id !== id) ?? [] },
    );
  }

  return { repos: data ?? [], isLoading, error, mutate, addRepo, triggerIndex, deleteRepo };
}
