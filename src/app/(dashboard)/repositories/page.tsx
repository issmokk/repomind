'use client';

import { toast } from 'sonner';
import { useRepos } from '@/hooks/use-repos';
import { RepoList } from '@/components/repositories/repo-list';

export default function RepositoriesPage() {
  const { repos, isLoading, addRepo, deleteRepo } = useRepos();

  async function handleReindex(id: string) {
    try {
      const res = await fetch(`/api/repos/${id}/index`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to trigger indexing');
      toast.success('Indexing started');
    } catch {
      toast.error('Failed to start indexing');
    }
  }

  return (
    <div className="p-4 md:p-6">
      <RepoList
        repos={repos}
        isLoading={isLoading}
        onAdd={addRepo}
        onReindex={handleReindex}
        onDelete={(id) => deleteRepo(id)}
      />
    </div>
  );
}
