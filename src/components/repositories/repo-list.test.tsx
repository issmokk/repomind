import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepoList } from './repo-list';
import type { RepoWithStatus } from '@/hooks/use-repos';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('./add-repo-dialog', () => ({
  AddRepoDialog: ({ onAdd }: { onAdd: (name: string) => Promise<void> }) => (
    <button onClick={() => onAdd('test/repo')}>Add Repository</button>
  ),
}));

const localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
  clear: vi.fn(() => { Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]); }),
  length: 0,
  key: vi.fn(() => null),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

const mockRepos: RepoWithStatus[] = [
  {
    id: '1', orgId: 'org1', name: 'repo1', fullName: 'owner/repo1',
    url: 'https://github.com/owner/repo1', defaultBranch: 'main',
    lastIndexedCommit: null, githubAuthType: 'pat', githubAppInstallationId: null,
    createdAt: '2024-01-01', updatedAt: '2024-01-01', latestJobStatus: 'completed',
  },
  {
    id: '2', orgId: 'org1', name: 'repo2', fullName: 'owner/repo2',
    url: 'https://github.com/owner/repo2', defaultBranch: 'main',
    lastIndexedCommit: null, githubAuthType: 'pat', githubAppInstallationId: null,
    createdAt: '2024-01-01', updatedAt: '2024-01-01', latestJobStatus: null,
  },
];

const defaultProps = {
  repos: mockRepos,
  isLoading: false,
  onAdd: vi.fn().mockResolvedValue('repo-123'),
  onTriggerIndex: vi.fn().mockResolvedValue(undefined),
  onReindex: vi.fn(),
  onDelete: vi.fn(),
};

beforeEach(() => {
  vi.restoreAllMocks();
  localStorageMock.clear();
  localStorageMock.getItem.mockImplementation((key: string) => localStorageStore[key] ?? null);
  localStorageMock.setItem.mockImplementation((key: string, value: string) => { localStorageStore[key] = value; });
});

describe('RepoList', () => {
  it('grid/list toggle switches layout', async () => {
    const user = userEvent.setup();
    const { container } = render(<RepoList {...defaultProps} />);

    expect(container.querySelector('.grid')).toBeInTheDocument();

    await user.click(screen.getByLabelText('List view'));
    expect(container.querySelector('.flex.flex-col.gap-2')).toBeInTheDocument();
  });

  it('grid/list preference is persisted to localStorage', async () => {
    const user = userEvent.setup();
    render(<RepoList {...defaultProps} />);

    await user.click(screen.getByLabelText('List view'));
    expect(localStorage.getItem('repo-view-mode')).toBe('list');
  });

  it('on mount, reads grid/list preference from localStorage', () => {
    localStorage.setItem('repo-view-mode', 'list');
    const { container } = render(<RepoList {...defaultProps} />);
    expect(container.querySelector('.flex.flex-col.gap-2')).toBeInTheDocument();
  });

  it('shows empty state component when repos array is empty', () => {
    render(<RepoList {...defaultProps} repos={[]} />);
    expect(screen.getByText('No repositories yet')).toBeInTheDocument();
  });

  it('renders one RepoCard per repository in the array', () => {
    render(<RepoList {...defaultProps} />);
    expect(screen.getByText('owner/repo1')).toBeInTheDocument();
    expect(screen.getByText('owner/repo2')).toBeInTheDocument();
  });
});
