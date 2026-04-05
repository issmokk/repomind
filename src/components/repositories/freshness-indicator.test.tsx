import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FreshnessIndicator } from './freshness-indicator';

vi.mock('swr', () => ({
  default: vi.fn(),
}));

import useSWR from 'swr';

const mockUseSWR = vi.mocked(useSWR);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FreshnessIndicator', () => {
  it('shows "Not indexed yet" when lastIndexedCommit is null', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<FreshnessIndicator repoId="repo-1" lastIndexedCommit={null} />);
    expect(screen.getByText('Not indexed yet')).toBeInTheDocument();
  });

  it('does not fetch when lastIndexedCommit is null', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<FreshnessIndicator repoId="repo-1" lastIndexedCommit={null} />);
    expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function), expect.any(Object));
  });

  it('shows commit SHA while loading', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: true,
      mutate: vi.fn(),
    });

    render(<FreshnessIndicator repoId="repo-1" lastIndexedCommit="abc1234def5678" />);
    expect(screen.getByText('abc1234')).toBeInTheDocument();
  });

  it('shows "Up to date" in green when behind is 0', () => {
    mockUseSWR.mockReturnValue({
      data: { behind: 0, lastIndexedCommit: 'abc1234', headSha: 'abc1234' },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<FreshnessIndicator repoId="repo-1" lastIndexedCommit="abc1234def5678" />);
    expect(screen.getByText('Up to date')).toBeInTheDocument();
    expect(screen.getByText('Up to date').closest('div')).toHaveClass('text-green-600');
  });

  it('shows yellow warning when 1-5 commits behind', () => {
    mockUseSWR.mockReturnValue({
      data: { behind: 3, lastIndexedCommit: 'abc1234', headSha: 'def5678' },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<FreshnessIndicator repoId="repo-1" lastIndexedCommit="abc1234def5678" />);
    expect(screen.getByText('3 commits behind HEAD')).toBeInTheDocument();
    expect(screen.getByText('3 commits behind HEAD').closest('div')).toHaveClass('text-yellow-600');
  });

  it('shows red warning when more than 5 commits behind', () => {
    mockUseSWR.mockReturnValue({
      data: { behind: 12, lastIndexedCommit: 'abc1234', headSha: 'xyz9999' },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<FreshnessIndicator repoId="repo-1" lastIndexedCommit="abc1234def5678" />);
    expect(screen.getByText('12 commits behind HEAD')).toBeInTheDocument();
    expect(screen.getByText('12 commits behind HEAD').closest('div')).toHaveClass('text-red-600');
  });

  it('uses singular "commit" for 1 behind', () => {
    mockUseSWR.mockReturnValue({
      data: { behind: 1, lastIndexedCommit: 'abc1234', headSha: 'def5678' },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<FreshnessIndicator repoId="repo-1" lastIndexedCommit="abc1234def5678" />);
    expect(screen.getByText('1 commit behind HEAD')).toBeInTheDocument();
  });

  it('shows stale commit warning when stale flag is set', () => {
    mockUseSWR.mockReturnValue({
      data: { behind: null, lastIndexedCommit: 'abc1234', headSha: null, stale: true },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<FreshnessIndicator repoId="repo-1" lastIndexedCommit="abc1234def5678" />);
    expect(screen.getByText('abc1234')).toBeInTheDocument();
    expect(screen.getByText(/commit no longer exists/i)).toBeInTheDocument();
    expect(screen.getByText(/commit no longer exists/i).closest('div')).toHaveClass('text-orange-600');
  });

  it('fetches the correct API endpoint', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: true,
      mutate: vi.fn(),
    });

    render(<FreshnessIndicator repoId="repo-42" lastIndexedCommit="abc1234" />);
    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/repos/repo-42/freshness',
      expect.any(Function),
      expect.objectContaining({ refreshInterval: 60_000 }),
    );
  });
});
