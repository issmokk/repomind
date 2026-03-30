import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepoDetailTabs } from './repo-detail-tabs';

vi.mock('./overview-tab', () => ({
  OverviewTab: () => <div data-testid="overview-tab">Overview Content</div>,
}));

vi.mock('./settings-tab', () => ({
  SettingsTab: () => <div data-testid="settings-tab">Settings Content</div>,
}));

vi.mock('./indexing-tab-placeholder', () => ({
  IndexingTabPlaceholder: () => <div data-testid="indexing-tab">Indexing Content</div>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const defaultProps = {
  repo: {
    id: 'repo-1',
    orgId: 'org-1',
    name: 'my-repo',
    fullName: 'owner/my-repo',
    url: 'https://github.com/owner/my-repo',
    defaultBranch: 'main',
    lastIndexedCommit: null,
    githubAuthType: 'pat' as const,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T12:00:00Z',
  },
  settings: {
    id: 'settings-1',
    repoId: 'repo-1',
    branchFilter: ['main'],
    includePatterns: [],
    excludePatterns: [],
    embeddingProvider: 'openai',
    embeddingModel: 'text-embedding-3-small',
    autoIndexOnAdd: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T12:00:00Z',
  },
  latestJob: null,
  mutateRepo: vi.fn(),
  mutateSettings: vi.fn(),
  mutateJob: vi.fn(),
};

describe('RepoDetailTabs', () => {
  it('renders all three tabs', () => {
    render(<RepoDetailTabs {...defaultProps} />);
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Indexing')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('default tab is Overview', () => {
    render(<RepoDetailTabs {...defaultProps} />);
    expect(screen.getByTestId('overview-tab')).toBeInTheDocument();
  });

  it('tab click switches content', async () => {
    const user = userEvent.setup();
    render(<RepoDetailTabs {...defaultProps} />);

    await user.click(screen.getByText('Settings'));
    expect(screen.getByTestId('settings-tab')).toBeInTheDocument();

    await user.click(screen.getByText('Overview'));
    expect(screen.getByTestId('overview-tab')).toBeInTheDocument();
  });
});
