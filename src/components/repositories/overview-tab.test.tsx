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

vi.mock('./freshness-indicator', () => ({
  FreshnessIndicator: ({ repoId, lastIndexedCommit }: { repoId: string; lastIndexedCommit: string | null }) => (
    <div data-testid="freshness-indicator" data-repo-id={repoId}>
      {lastIndexedCommit ? lastIndexedCommit.slice(0, 7) : 'Not indexed'}
    </div>
  ),
}));

let mockSWRData: { behind: number | null } | undefined = undefined;
vi.mock('swr', async () => {
  const actual = await vi.importActual<typeof import('swr')>('swr');
  return {
    ...actual,
    default: vi.fn((key: string | null) => {
      if (key && key.includes('/freshness')) {
        return { data: mockSWRData, isLoading: false, isValidating: false, mutate: vi.fn() };
      }
      return { data: undefined, isLoading: false, isValidating: false, mutate: vi.fn() };
    }),
  };
});

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
    githubAppInstallationId: null,
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
  mockSWRData = undefined;
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
  });

  it('renders the freshness indicator', () => {
    render(<OverviewTab {...defaultProps} />);
    const indicator = screen.getByTestId('freshness-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute('data-repo-id', 'repo-1');
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

  it('shows "Update Index" button when commits behind', () => {
    mockSWRData = { behind: 5 };
    render(<OverviewTab {...defaultProps} />);
    expect(screen.getByRole('button', { name: /update index/i })).toBeInTheDocument();
    expect(screen.getByText(/5 commits behind/)).toBeInTheDocument();
  });

  it('does not show "Update Index" button when up to date', () => {
    mockSWRData = { behind: 0 };
    render(<OverviewTab {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /update index/i })).not.toBeInTheDocument();
  });

  it('does not show "Update Index" button when freshness unknown', () => {
    mockSWRData = undefined;
    render(<OverviewTab {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /update index/i })).not.toBeInTheDocument();
  });

  it('"Update Index" button triggers re-index', async () => {
    mockSWRData = { behind: 3 };
    const user = userEvent.setup();
    const mutateJob = vi.fn();
    render(<OverviewTab {...defaultProps} mutateJob={mutateJob} />);

    await user.click(screen.getByRole('button', { name: /update index/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/repos/repo-1/index',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(mutateJob).toHaveBeenCalled();
  });

  it('shows "Full Re-index" button when commit is stale', () => {
    mockSWRData = { behind: null, stale: true } as never;
    render(<OverviewTab {...defaultProps} />);
    expect(screen.getByRole('button', { name: /full re-index/i })).toBeInTheDocument();
    expect(screen.getByText(/stale commit/)).toBeInTheDocument();
  });

  it('uses singular "commit" for 1 behind', () => {
    mockSWRData = { behind: 1 };
    render(<OverviewTab {...defaultProps} />);
    expect(screen.getByText(/1 commit behind/)).toBeInTheDocument();
    expect(screen.queryByText(/1 commits behind/)).not.toBeInTheDocument();
  });
});
