'use client';

import { useState, useEffect } from 'react';
import { Play, Square, AlertTriangle, ChevronDown, ChevronRight, RotateCcw, RefreshCw, ArrowUpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusBadge } from '@/components/shared/status-badge';
import { mapJobStatus } from '@/lib/status-utils';
import { useIndexingStatus } from '@/hooks/use-indexing-status';
import type { IndexingJob, PipelineStage } from '@/types/indexing';

const ACTIVE_STATUSES = ['pending', 'fetching_files', 'processing', 'embedding'] as const;

const PIPELINE_STAGES: { key: PipelineStage; label: string }[] = [
  { key: 'fetching_content', label: 'Fetch' },
  { key: 'parsing', label: 'Parse' },
  { key: 'embedding', label: 'Embed' },
  { key: 'storing', label: 'Store' },
];

function isActive(status: string): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(status);
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    fetching_files: 'Fetching Files',
    processing: 'Processing',
    embedding: 'Embedding',
    completed: 'Completed',
    failed: 'Failed',
    partial: 'Partial',
  };
  return labels[status] ?? status;
}

function formatDuration(startedAt: string | null, endedAt?: string | null): string {
  if (!startedAt) return '0s';
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const secs = Math.floor((end - start) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  return `${mins}m ${remainSecs}s`;
}

type IndexAction = 'update' | 'full' | 'retry';

interface IndexingTabProps {
  repoId: string;
  initialJob?: IndexingJob | null;
  hasLastIndexedCommit?: boolean;
}

export function IndexingTab({ repoId, initialJob, hasLastIndexedCommit = false }: IndexingTabProps) {
  const { job: liveJob, isConnected } = useIndexingStatus(repoId);
  const job = liveJob ?? initialJob ?? null;
  const active = job ? isActive(job.status) : false;
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [errorLogOpen, setErrorLogOpen] = useState(false);
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!active || !job?.startedAt) {
      setElapsed('');
      return;
    }
    setElapsed(formatDuration(job.startedAt));
    const timer = setInterval(() => {
      setElapsed(formatDuration(job.startedAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [active, job?.startedAt]);

  async function triggerIndex(action: IndexAction = 'full') {
    setStarting(true);
    try {
      const body: Record<string, unknown> = { trigger: 'manual' };
      if (action === 'retry') body.retryFailed = true;
      else body.mode = action;

      const res = await fetch(`/api/repos/${repoId}/index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 409) {
        toast.error('Indexing is already in progress');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Failed to start indexing');
        return;
      }
      const labels: Record<IndexAction, string> = {
        update: 'Updating index',
        full: 'Full re-index started',
        retry: 'Retrying failed files',
      };
      toast.success(labels[action]);
    } catch {
      toast.error('Failed to start indexing');
    } finally {
      setStarting(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/repos/${repoId}/index`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Failed to cancel indexing');
        return;
      }
      toast.success('Indexing cancelled');
    } catch {
      toast.error('Failed to cancel indexing');
    } finally {
      setCancelling(false);
    }
  }

  const canRetryFailed = !active && job?.status === 'partial' && job.failedFiles > 0;
  const canUpdate = hasLastIndexedCommit;

  const defaultAction: IndexAction = canRetryFailed ? 'retry'
    : canUpdate ? 'update'
    : 'full';

  const actionLabels: Record<IndexAction, string> = {
    update: 'Update Index',
    full: 'Full Re-index',
    retry: `Retry Failed (${job?.failedFiles ?? 0})`,
  };

  const actionIcons: Record<IndexAction, typeof Play> = {
    update: ArrowUpCircle,
    full: RefreshCw,
    retry: RotateCcw,
  };

  const percentage = job && job.totalFiles > 0
    ? Math.round((job.processedFiles / job.totalFiles) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Indexing Status</h3>
          <span
            className={`inline-block size-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`}
            title={isConnected ? 'Connected' : 'Disconnected'}
          />
        </div>
        {!active && (() => {
          const DefaultIcon = actionIcons[defaultAction];
          return (
            <div className="flex items-center gap-1">
              <Button onClick={() => triggerIndex(defaultAction)} disabled={starting} size="sm">
                <DefaultIcon className="size-3.5" />
                {starting ? 'Starting...' : actionLabels[defaultAction]}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="inline-flex h-8 items-center justify-center rounded-md border bg-background px-1.5 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                  disabled={starting}
                >
                  <ChevronDown className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canUpdate && (
                    <DropdownMenuItem onClick={() => triggerIndex('update')}>
                      <ArrowUpCircle className="size-3.5" />
                      Update Index
                    </DropdownMenuItem>
                  )}
                  {canRetryFailed && (
                    <DropdownMenuItem onClick={() => triggerIndex('retry')}>
                      <RotateCcw className="size-3.5" />
                      Retry Failed ({job?.failedFiles})
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => triggerIndex('full')}>
                    <RefreshCw className="size-3.5" />
                    Full Re-index
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })()}
        {active && (
          <Button variant="destructive" onClick={handleCancel} disabled={cancelling} size="sm">
            <Square className="size-3.5" />
            {cancelling ? 'Cancelling...' : 'Cancel'}
          </Button>
        )}
      </div>

      {active && job && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <StatusBadge status={mapJobStatus(job.status)} />
                <span className="text-muted-foreground">{formatStatus(job.status)}</span>
              </div>
              {elapsed && (
                <span className="text-xs text-muted-foreground font-mono">{elapsed}</span>
              )}
            </div>

            {job.currentStage && (
              <div className="flex items-center gap-1">
                {PIPELINE_STAGES.map((stage, i) => {
                  const currentIdx = PIPELINE_STAGES.findIndex((s) => s.key === job.currentStage);
                  const isComplete = i < currentIdx;
                  const isCurrent = i === currentIdx;
                  return (
                    <div key={stage.key} className="flex items-center gap-1">
                      {i > 0 && (
                        <div className={`h-px w-3 ${isComplete || isCurrent ? 'bg-blue-500' : 'bg-muted-foreground/30'}`} />
                      )}
                      <span
                        className={`text-[11px] font-medium ${
                          isCurrent ? 'text-blue-500' : isComplete ? 'text-muted-foreground' : 'text-muted-foreground/40'
                        }`}
                      >
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span>{percentage}%</span>
                <span className="text-muted-foreground font-mono">
                  {job.processedFiles} / {job.totalFiles} files
                </span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={percentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Indexing progress: ${percentage}%`}
              >
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>

            {job.currentFile && (
              <p
                className="truncate text-xs text-muted-foreground font-mono"
                title={job.currentFile}
              >
                {job.currentFile}
              </p>
            )}

            {job.failedFiles > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setErrorLogOpen(!errorLogOpen)}
                  className="inline-flex items-center gap-1 text-xs text-destructive"
                >
                  <AlertTriangle className="size-3" />
                  <span>{job.failedFiles} errors</span>
                  {errorLogOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                </button>
                {errorLogOpen && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded border bg-muted/50 p-2">
                    {job.errorLog.map((entry, i) => (
                      <div key={i} className="text-xs py-1 border-b last:border-0">
                        {entry.file && (
                          <span className="font-mono text-foreground">{entry.file}: </span>
                        )}
                        <span className="text-destructive">{entry.error}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!active && job && (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <StatusBadge status={mapJobStatus(job.status)} />
              <span className="text-sm text-muted-foreground">{formatStatus(job.status)}</span>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">Files</dt>
                <dd className="font-mono">{job.processedFiles} / {job.totalFiles}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Failed</dt>
                <dd className="font-mono">{job.failedFiles}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Duration</dt>
                <dd className="font-mono">{formatDuration(job.startedAt, job.completedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Trigger</dt>
                <dd className="font-mono">{job.triggerType}</dd>
              </div>
            </dl>

            {job.failedFiles > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setErrorLogOpen(!errorLogOpen)}
                  className="inline-flex items-center gap-1 text-xs text-destructive"
                >
                  <AlertTriangle className="size-3" />
                  <span>{job.failedFiles} errors</span>
                  {errorLogOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                </button>
                {errorLogOpen && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded border bg-muted/50 p-2">
                    {job.errorLog.map((entry, i) => (
                      <div key={i} className="text-xs py-1 border-b last:border-0">
                        {entry.file && (
                          <span className="font-mono text-foreground">{entry.file}: </span>
                        )}
                        <span className="text-destructive">{entry.error}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!job && (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No indexing jobs found. Click Start Indexing to begin.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
