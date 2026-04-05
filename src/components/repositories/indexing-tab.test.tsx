import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IndexingTab } from './indexing-tab';
import type { IndexingJob } from '@/types/indexing';

vi.mock('@/hooks/use-indexing-status', () => ({
  useIndexingStatus: vi.fn(() => ({ job: null, isConnected: true })),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function makeJob(overrides: Partial<IndexingJob> = {}): IndexingJob {
  return {
    id: 'job-1',
    repoId: 'repo-1',
    status: 'processing',
    triggerType: 'manual',
    fromCommit: null,
    toCommit: 'abc1234',
    totalFiles: 200,
    processedFiles: 50,
    failedFiles: 0,
    currentFile: null,
    errorLog: [],
    lastHeartbeatAt: null,
    startedAt: '2024-06-01T12:00:00Z',
    completedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 })),
  ) as unknown as typeof fetch;
});

describe('IndexingTab', () => {
  it('shows "Full Re-index" as default when repo never indexed', () => {
    render(<IndexingTab repoId="repo-1" />);
    expect(screen.getByRole('button', { name: /full re-index/i })).toBeInTheDocument();
  });

  it('shows "Update Index" as default when repo has been indexed', () => {
    render(<IndexingTab repoId="repo-1" hasLastIndexedCommit />);
    expect(screen.getByRole('button', { name: /update index/i })).toBeInTheDocument();
  });

  it('shows progress bar with percentage when job active', async () => {
    const { useIndexingStatus } = await import('@/hooks/use-indexing-status');
    vi.mocked(useIndexingStatus).mockReturnValue({
      job: makeJob({ processedFiles: 50, totalFiles: 200 }),
      isConnected: true,
    });

    render(<IndexingTab repoId="repo-1" />);
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('50 / 200 files')).toBeInTheDocument();
  });

  it('shows current file being processed', async () => {
    const { useIndexingStatus } = await import('@/hooks/use-indexing-status');
    vi.mocked(useIndexingStatus).mockReturnValue({
      job: makeJob({ currentFile: 'src/lib/parser.ts' }),
      isConnected: true,
    });

    render(<IndexingTab repoId="repo-1" />);
    expect(screen.getByText('src/lib/parser.ts')).toBeInTheDocument();
  });

  it('shows error count when errors exist', async () => {
    const { useIndexingStatus } = await import('@/hooks/use-indexing-status');
    vi.mocked(useIndexingStatus).mockReturnValue({
      job: makeJob({
        failedFiles: 3,
        errorLog: [
          { error: 'Parse error', file: 'a.ts', timestamp: '2024-01-01T00:00:00Z' },
          { error: 'Parse error', file: 'b.ts', timestamp: '2024-01-01T00:00:00Z' },
          { error: 'Parse error', file: 'c.ts', timestamp: '2024-01-01T00:00:00Z' },
        ],
      }),
      isConnected: true,
    });

    render(<IndexingTab repoId="repo-1" />);
    expect(screen.getByText('3 errors')).toBeInTheDocument();
  });

  it('cancel button visible during active job', async () => {
    const { useIndexingStatus } = await import('@/hooks/use-indexing-status');
    vi.mocked(useIndexingStatus).mockReturnValue({
      job: makeJob(),
      isConnected: true,
    });

    render(<IndexingTab repoId="repo-1" />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('default button calls POST with correct mode', async () => {
    const { useIndexingStatus } = await import('@/hooks/use-indexing-status');
    vi.mocked(useIndexingStatus).mockReturnValue({
      job: null,
      isConnected: true,
    });

    const user = userEvent.setup();
    render(<IndexingTab repoId="repo-1" hasLastIndexedCommit />);

    await user.click(screen.getByRole('button', { name: /update index/i }));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/repos/repo-1/index',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ trigger: 'manual', mode: 'update' }),
      }),
    );
  });

  it('full re-index sends mode=full', async () => {
    const { useIndexingStatus } = await import('@/hooks/use-indexing-status');
    vi.mocked(useIndexingStatus).mockReturnValue({
      job: null,
      isConnected: true,
    });

    const user = userEvent.setup();
    render(<IndexingTab repoId="repo-1" />);

    await user.click(screen.getByRole('button', { name: /full re-index/i }));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/repos/repo-1/index',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ trigger: 'manual', mode: 'full' }),
      }),
    );
  });

  it('shows completed job summary when job is done', async () => {
    const { useIndexingStatus } = await import('@/hooks/use-indexing-status');
    vi.mocked(useIndexingStatus).mockReturnValue({
      job: makeJob({
        status: 'completed',
        processedFiles: 200,
        totalFiles: 200,
        completedAt: '2024-06-01T12:05:00Z',
      }),
      isConnected: true,
    });

    render(<IndexingTab repoId="repo-1" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('200 / 200')).toBeInTheDocument();
  });
});
