'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { mapJobStatus } from '@/lib/status-utils';
import type { Repository } from '@/types/repository';
import type { IndexingJob } from '@/types/indexing';
import type { KeyedMutator } from 'swr';

function formatNumber(n: number): string {
  return n.toLocaleString();
}

interface OverviewTabProps {
  repo: Repository;
  latestJob: IndexingJob | null;
  mutateRepo: KeyedMutator<Repository>;
  mutateJob: KeyedMutator<IndexingJob | { status: 'none' }>;
}

export function OverviewTab({ repo, latestJob, mutateRepo, mutateJob }: OverviewTabProps) {
  const router = useRouter();
  const [reindexing, setReindexing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleReindex() {
    setReindexing(true);
    try {
      const res = await fetch(`/api/repos/${repo.id}/index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual' }),
      });
      if (res.status === 409) {
        toast.error('Indexing is already in progress');
        return;
      }
      if (!res.ok) {
        toast.error('Failed to start indexing');
        return;
      }
      toast.success('Indexing started');
      await mutateJob();
    } catch {
      toast.error('Failed to start indexing');
    } finally {
      setReindexing(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/repos/${repo.id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Failed to delete repository');
        return;
      }
      toast.success('Repository deleted');
      await mutateRepo(undefined, { revalidate: false });
      router.push('/repositories');
    } catch {
      toast.error('Failed to delete repository');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  const stats = [
    { label: 'Files Indexed', value: formatNumber(latestJob?.totalFiles ?? 0) },
    { label: 'Chunks Created', value: formatNumber(latestJob?.processedFiles ?? 0) },
    {
      label: 'Last Indexed Commit',
      value: repo.lastIndexedCommit ? repo.lastIndexedCommit.slice(0, 7) : 'Never',
      mono: true,
    },
    { label: 'Status', badge: true },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} size="sm">
            <CardContent>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              {stat.badge ? (
                <div className="mt-1">
                  <StatusBadge status={mapJobStatus(latestJob?.status)} />
                </div>
              ) : (
                <p className={`text-lg font-semibold ${stat.mono ? 'font-mono text-sm' : ''}`}>
                  {stat.value}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Repository Info</h3>
          </div>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Full Name</dt>
              <dd className="font-mono">{repo.fullName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">URL</dt>
              <dd>
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-foreground hover:underline"
                >
                  {repo.url}
                  <ExternalLink className="size-3" />
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Default Branch</dt>
              <dd className="font-mono">{repo.defaultBranch}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button onClick={handleReindex} disabled={reindexing}>
          <RefreshCw className={`size-4 ${reindexing ? 'animate-spin' : ''}`} />
          Re-index
        </Button>
        <Button variant="destructive" onClick={() => setDeleteOpen(true)} disabled={deleting}>
          <Trash2 className={`size-4 ${deleting ? 'animate-spin' : ''}`} />
          {deleting ? 'Deleting...' : 'Delete'}
        </Button>
      </div>

      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete repository"
        description={`This will permanently delete ${repo.fullName} and all indexed data.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
