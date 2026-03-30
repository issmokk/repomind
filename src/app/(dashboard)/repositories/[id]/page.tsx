'use client';

import { use } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { useRepoDetail } from '@/hooks/use-repo-detail';
import { StatusBadge } from '@/components/shared/status-badge';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { RepoDetailTabs } from '@/components/repositories/repo-detail-tabs';
import { RepoDetailSkeleton } from '@/components/repositories/repo-detail-skeleton';
import { mapJobStatus } from '@/lib/status-utils';

export default function RepoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <ErrorBoundary>
      <RepoDetailContent id={id} />
    </ErrorBoundary>
  );
}

function RepoDetailContent({ id }: { id: string }) {
  const { repo, settings, latestJob, isLoading, error, mutateRepo, mutateSettings, mutateJob } =
    useRepoDetail(id);

  if (isLoading) {
    return <RepoDetailSkeleton />;
  }

  if (error || !repo) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          {error?.message || 'Repository not found'}
        </p>
        <Link href="/repositories" className="text-sm text-primary hover:underline">
          Back to repositories
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold font-mono">{repo.fullName}</h1>
        <StatusBadge status={mapJobStatus(latestJob?.status)} />
        <a
          href={repo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="size-4" />
        </a>
      </div>

      <RepoDetailTabs
        repo={repo}
        settings={settings}
        latestJob={latestJob}
        mutateRepo={mutateRepo}
        mutateSettings={mutateSettings}
        mutateJob={mutateJob}
      />
    </div>
  );
}
