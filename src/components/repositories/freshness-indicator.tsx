'use client';

import useSWR from 'swr';
import { GitCommit, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { FreshnessResponse } from '@/app/api/repos/[id]/freshness/route';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function getColor(behind: number): { text: string; icon: string } {
  if (behind === 0) return { text: 'text-green-600', icon: 'text-green-500' };
  if (behind <= 5) return { text: 'text-yellow-600', icon: 'text-yellow-500' };
  return { text: 'text-red-600', icon: 'text-red-500' };
}

interface FreshnessIndicatorProps {
  repoId: string;
  lastIndexedCommit: string | null;
}

export function FreshnessIndicator({ repoId, lastIndexedCommit }: FreshnessIndicatorProps) {
  const { data, isLoading } = useSWR<FreshnessResponse>(
    lastIndexedCommit ? `/api/repos/${repoId}/freshness` : null,
    fetcher,
    { refreshInterval: 60_000, dedupingInterval: 30_000 },
  );

  if (!lastIndexedCommit) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <GitCommit className="size-4" />
        <span>Not indexed yet</span>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <GitCommit className="size-4" />
        <span className="font-mono">{lastIndexedCommit.slice(0, 7)}</span>
      </div>
    );
  }

  if (data.behind === null || data.behind === undefined) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <GitCommit className="size-4" />
        <span>Not indexed yet</span>
      </div>
    );
  }

  const colors = getColor(data.behind);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-sm">
        <GitCommit className="size-4 text-muted-foreground" />
        <span className="font-mono">{lastIndexedCommit.slice(0, 7)}</span>
      </div>
      <div className={`flex items-center gap-1 text-xs font-medium ${colors.text}`}>
        {data.behind === 0 ? (
          <>
            <CheckCircle2 className={`size-3 ${colors.icon}`} />
            <span>Up to date</span>
          </>
        ) : (
          <>
            <AlertTriangle className={`size-3 ${colors.icon}`} />
            <span>
              {data.behind} commit{data.behind !== 1 ? 's' : ''} behind HEAD
            </span>
          </>
        )}
      </div>
    </div>
  );
}
