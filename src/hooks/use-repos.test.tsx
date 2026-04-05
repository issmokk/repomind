import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useRepos } from './use-repos';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';

const mockRepos = [
  { id: '1', orgId: 'org1', name: 'repo1', fullName: 'owner/repo1', url: 'https://github.com/owner/repo1', defaultBranch: 'main', lastIndexedCommit: null, githubAuthType: 'pat' as const, createdAt: '2024-01-01', updatedAt: '2024-01-01', latestJobStatus: 'completed' as const },
  { id: '2', orgId: 'org1', name: 'repo2', fullName: 'owner/repo2', url: 'https://github.com/owner/repo2', defaultBranch: 'main', lastIndexedCommit: null, githubAuthType: 'pat' as const, createdAt: '2024-01-01', updatedAt: '2024-01-01', latestJobStatus: null },
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

describe('useRepos', () => {
  it('fetches from /api/repos using SWR', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockRepos), { status: 200 }),
    );

    const { result } = renderHook(() => useRepos(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.repos).toHaveLength(2);
    expect(result.current.repos[0].fullName).toBe('owner/repo1');
  });

  it('returns repos, isLoading, error, mutate', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockRepos), { status: 200 }),
    );

    const { result } = renderHook(() => useRepos(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeUndefined();
    expect(typeof result.current.mutate).toBe('function');
  });

  it('addRepo calls POST /api/repos and mutates the cache', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockRepos), { status: 200 }));

    const { result } = renderHook(() => useRepos(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const newRepo = { ...mockRepos[0], id: '3', fullName: 'owner/repo3' };
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(newRepo), { status: 200 }));
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify([...mockRepos, newRepo]), { status: 200 }));

    let repoId: string | undefined;
    await act(async () => {
      repoId = await result.current.addRepo('owner/repo3');
    });

    expect(repoId).toBe('3');
    const postCall = fetchSpy.mock.calls.find(
      (call) => call[1] && (call[1] as RequestInit).method === 'POST',
    );
    expect(postCall).toBeDefined();
    expect(postCall![0]).toBe('/api/repos');
  });

  it('triggerIndex calls POST /api/repos/:id/index', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockRepos), { status: 200 }));

    const { result } = renderHook(() => useRepos(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ jobId: 'j1', status: 'pending' }), { status: 200 }));

    await act(() => result.current.triggerIndex('1'));

    const indexCall = fetchSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('/index'),
    );
    expect(indexCall).toBeDefined();
    expect(indexCall![0]).toBe('/api/repos/1/index');
  });

  it('deleteRepo calls DELETE /api/repos/:id and mutates the cache', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockRepos), { status: 200 }));

    const { result } = renderHook(() => useRepos(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await act(() => result.current.deleteRepo('1'));

    const deleteCall = fetchSpy.mock.calls.find(
      (call) => call[1] && (call[1] as RequestInit).method === 'DELETE',
    );
    expect(deleteCall).toBeDefined();
    expect(deleteCall![0]).toBe('/api/repos/1');
  });
});
