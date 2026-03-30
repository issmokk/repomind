import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useGitHubRepos } from './use-github-repos';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';

const mockGitHubRepos = [
  { full_name: 'owner/alpha', private: false, language: 'TypeScript', stargazers_count: 10, updated_at: '2024-06-01T00:00:00Z' },
  { full_name: 'owner/beta', private: true, language: 'Python', stargazers_count: 5, updated_at: '2024-05-01T00:00:00Z' },
];

function wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>
      {children}
    </SWRConfig>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('useGitHubRepos', () => {
  it('fetches from /api/github/repos?per_page=100&sort=updated', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockGitHubRepos), { status: 200 }),
    );

    const { result } = renderHook(() => useGitHubRepos(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchSpy.mock.calls[0][0]).toContain('/api/github/repos?per_page=100&sort=updated');
  });

  it('returns repos array, isLoading, error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockGitHubRepos), { status: 200 }),
    );

    const { result } = renderHook(() => useGitHubRepos(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.repos).toHaveLength(2);
    expect(result.current.error).toBeUndefined();
  });

  it('handles 401 response by setting needsReconnect to true', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'github_token_expired', reconnect: true }), { status: 401 }),
    );

    const { result } = renderHook(() => useGitHubRepos(), { wrapper });
    await waitFor(() => expect(result.current.error).toBeDefined());

    expect(result.current.needsReconnect).toBe(true);
  });

  it('client-side filtering by name filters the loaded set', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockGitHubRepos), { status: 200 }),
    );

    const { result } = renderHook(() => useGitHubRepos(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setSearch('alpha');
    });

    expect(result.current.repos).toHaveLength(1);
    expect(result.current.repos[0].full_name).toBe('owner/alpha');
  });

  it('loadMore fetches next page and appends to existing data', async () => {
    const page2Repos = [
      { full_name: 'owner/gamma', private: false, language: 'Go', stargazers_count: 3, updated_at: '2024-04-01T00:00:00Z' },
    ];

    const hundredRepos = Array.from({ length: 100 }, (_, i) => ({
      full_name: `owner/repo-${i}`,
      private: false,
      language: 'TypeScript',
      stargazers_count: i,
      updated_at: '2024-06-01T00:00:00Z',
    }));

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(hundredRepos), { status: 200 }));

    const { result } = renderHook(() => useGitHubRepos(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasMore).toBe(true);

    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(page2Repos), { status: 200 }));

    await act(async () => {
      await result.current.loadMore();
    });

    await waitFor(() => expect(result.current.repos.length).toBeGreaterThan(100));
    expect(result.current.repos.some((r) => r.full_name === 'owner/gamma')).toBe(true);
  });
});
