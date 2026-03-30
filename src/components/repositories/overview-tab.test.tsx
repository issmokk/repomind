import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OverviewTab } from './overview-tab';
import type { Repository } from '@/types/repository';
import type { IndexingJob } from '@/types/indexing';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function makeRepo(overrides: Partial<Repository> = {}): Repository {
  return {
    id: 'repo-1',
    orgId: 'org-1',
    name: 'my-repo',
    fullName: 'owner/my-repo',
    url: 'https://github.com/owner/my-repo',
    defaultBranch: 'main',
    lastIndexedCommit: 'abc1234def5678',
    githubAuthType: 'pat',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T12:00:00Z',
    ...overrides,
  };
}

function makeJob(overrides: Partial<IndexingJob> = {}): IndexingJob {
  return {
    id: 'job-1',
    repoId: 'repo-1',
    status: 'completed',
    triggerType: 'manual',
    fromCommit: null,
    toCommit: 'abc1234',
    totalFiles: 42,
    processedFiles: 120,
    failedFiles: 0,
    currentFile: null,
    errorLog: [],
    lastHeartbeatAt: null,
    startedAt: '2024-06-01T12:00:00Z',
    completedAt: '2024-06-01T12:05:00Z',
    ...overrides,
  };
}

const defaultProps = {
  repo: makeRepo(),
  latestJob: makeJob(),
  mutateRepo: vi.fn(),
  mutateJob: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 })),
  ) as unknown as typeof fetch;
});

describe('OverviewTab', () => {
  it('renders repo info', () => {
    render(<OverviewTab {...defaultProps} />);
    expect(screen.getByText('owner/my-repo')).toBeInTheDocument();
    expect(screen.getByText('https://github.com/owner/my-repo')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('Indexed')).toBeInTheDocument();
  });

  it('renders stats from the latest job', () => {
    render(<OverviewTab {...defaultProps} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('abc1234')).toBeInTheDocument();
  });

  it('re-index button calls POST /api/repos/:id/index', async () => {
    const user = userEvent.setup();
    const mutateJob = vi.fn();
    render(<OverviewTab {...defaultProps} mutateJob={mutateJob} />);

    await user.click(screen.getByRole('button', { name: /re-index/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/repos/repo-1/index',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(mutateJob).toHaveBeenCalled();
  });

  it('delete button opens confirmation dialog', async () => {
    const user = userEvent.setup();
    render(<OverviewTab {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(
      screen.getByText('This will permanently delete owner/my-repo and all indexed data.'),
    ).toBeInTheDocument();
  });

  it('confirming delete calls DELETE /api/repos/:id and navigates', async () => {
    const user = userEvent.setup();
    const mutateRepo = vi.fn();
    render(<OverviewTab {...defaultProps} mutateRepo={mutateRepo} />);

    await user.click(screen.getByRole('button', { name: /delete/i }));
    const confirmButtons = screen.getAllByRole('button', { name: /delete/i });
    const confirmBtn = confirmButtons.find((btn) => btn.closest('[data-slot="dialog-content"]'));
    await user.click(confirmBtn!);

    expect(global.fetch).toHaveBeenCalledWith('/api/repos/repo-1', { method: 'DELETE' });
    expect(push).toHaveBeenCalledWith('/repositories');
  });

  it('shows "Never" when lastIndexedCommit is null', () => {
    render(<OverviewTab {...defaultProps} repo={makeRepo({ lastIndexedCommit: null })} />);
    expect(screen.getByText('Never')).toBeInTheDocument();
  });
});
