'use client';

import { memo, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import type { RepoWithStatus } from '@/hooks/use-repos';
import type { IndexingJobStatus } from '@/types/indexing';

type StatusBadgeVariant = 'indexed' | 'indexing' | 'error' | 'pending' | 'partial';

function mapJobStatus(status: IndexingJobStatus | null): StatusBadgeVariant {
  if (!status || status === 'pending') return 'pending';
  if (status === 'completed') return 'indexed';
  if (status === 'failed') return 'error';
  if (status === 'partial') return 'partial';
  return 'indexing';
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHour > 0) return `${diffHour}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return 'just now';
}

interface RepoCardProps {
  repo: RepoWithStatus;
  onReindex: (id: string) => void;
  onDelete: (id: string) => void;
  viewMode: 'grid' | 'list';
}

export const RepoCard = memo(function RepoCard({ repo, onReindex, onDelete, viewMode }: RepoCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <Link href={`/repositories/${repo.id}`} className="block">
        <Card
          className={
            viewMode === 'list'
              ? 'flex-row items-center py-3'
              : ''
          }
        >
          <CardContent
            className={
              viewMode === 'list'
                ? 'flex flex-1 items-center justify-between gap-4'
                : 'space-y-2'
            }
          >
            <div className={viewMode === 'list' ? 'flex items-center gap-4 min-w-0' : 'space-y-2'}>
              <span className="font-mono text-sm font-medium truncate">{repo.fullName}</span>
              <StatusBadge status={mapJobStatus(repo.latestJobStatus)} />
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(repo.updatedAt)}
              </span>
            </div>
            <div
              className={viewMode === 'list' ? 'flex items-center gap-1 shrink-0' : 'flex items-center gap-1 pt-1'}
              onClick={(e) => e.preventDefault()}
            >
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.preventDefault();
                  onReindex(repo.id);
                }}
                aria-label="Re-index repository"
              >
                <RefreshCw className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.preventDefault();
                  setDeleteOpen(true);
                }}
                aria-label="Delete repository"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </Link>
      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete repository"
        description={`Are you sure you want to delete ${repo.fullName}? This will remove all indexed data.`}
        onConfirm={() => {
          onDelete(repo.id);
          setDeleteOpen(false);
        }}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );
});
