import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepoCard } from './repo-card';
import type { RepoWithStatus } from '@/hooks/use-repos';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

function makeRepo(overrides: Partial<RepoWithStatus> = {}): RepoWithStatus {
  return {
    id: '1',
    orgId: 'org1',
    name: 'my-repo',
    fullName: 'owner/my-repo',
    url: 'https://github.com/owner/my-repo',
    defaultBranch: 'main',
    lastIndexedCommit: null,
    githubAuthType: 'pat',
    githubAppInstallationId: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T12:00:00Z',
    latestJobStatus: null,
    ...overrides,
  };
}

describe('RepoCard', () => {
  it('renders repo full name, status badge, and last indexed time', () => {
    render(
      <RepoCard repo={makeRepo()} onReindex={vi.fn()} onDelete={vi.fn()} viewMode="grid" />,
    );
    expect(screen.getByText('owner/my-repo')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders "Indexed" when latestJobStatus is completed', () => {
    render(
      <RepoCard
        repo={makeRepo({ latestJobStatus: 'completed' })}
        onReindex={vi.fn()}
        onDelete={vi.fn()}
        viewMode="grid"
      />,
    );
    expect(screen.getByText('Indexed')).toBeInTheDocument();
  });

  it('renders "Indexing" with pulse when latestJobStatus is processing', () => {
    render(
      <RepoCard
        repo={makeRepo({ latestJobStatus: 'processing' })}
        onReindex={vi.fn()}
        onDelete={vi.fn()}
        viewMode="grid"
      />,
    );
    expect(screen.getByText('Indexing')).toBeInTheDocument();
    expect(screen.getByTestId('status-dot')).toHaveClass('animate-pulse');
  });

  it('renders "Error" when latestJobStatus is failed', () => {
    render(
      <RepoCard
        repo={makeRepo({ latestJobStatus: 'failed' })}
        onReindex={vi.fn()}
        onDelete={vi.fn()}
        viewMode="grid"
      />,
    );
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('renders "Pending" when latestJobStatus is null', () => {
    render(
      <RepoCard repo={makeRepo()} onReindex={vi.fn()} onDelete={vi.fn()} viewMode="grid" />,
    );
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('clicking the card navigates to /repositories/[id]', () => {
    render(
      <RepoCard repo={makeRepo()} onReindex={vi.fn()} onDelete={vi.fn()} viewMode="grid" />,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/repositories/1');
  });

  it('re-index button calls onReindex callback', async () => {
    const user = userEvent.setup();
    const onReindex = vi.fn();
    render(
      <RepoCard repo={makeRepo()} onReindex={onReindex} onDelete={vi.fn()} viewMode="grid" />,
    );
    await user.click(screen.getByLabelText('Re-index repository'));
    expect(onReindex).toHaveBeenCalledWith('1');
  });

  it('delete button calls onDelete callback after confirmation', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <RepoCard repo={makeRepo()} onReindex={vi.fn()} onDelete={onDelete} viewMode="grid" />,
    );
    await user.click(screen.getByLabelText('Delete repository'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith('1');
  });
});
