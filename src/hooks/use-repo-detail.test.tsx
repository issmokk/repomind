import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';
import { useRepoDetail } from './use-repo-detail';
import { FetchError } from '@/lib/fetcher';

const originalFetch = global.fetch;

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

const mockRepo = {
  id: 'repo-1',
  orgId: 'org-1',
  name: 'my-repo',
  fullName: 'owner/my-repo',
  url: 'https://github.com/owner/my-repo',
  defaultBranch: 'main',
  lastIndexedCommit: 'abc1234',
  githubAuthType: 'pat',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-06-01T12:00:00Z',
};

const mockSettings = {
  id: 'settings-1',
  repoId: 'repo-1',
  branchFilter: ['main'],
  includePatterns: [],
  excludePatterns: ['node_modules/**'],
  embeddingProvider: 'openai',
  embeddingModel: 'text-embedding-3-small',
  autoIndexOnAdd: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-06-01T12:00:00Z',
};

const mockJob = {
  id: 'job-1',
  repoId: 'repo-1',
  status: 'completed',
  triggerType: 'manual',
  fromCommit: null,
  toCommit: 'abc1234',
  totalFiles: 42,
  processedFiles: 42,
  failedFiles: 0,
  currentFile: null,
  errorLog: [],
  lastHeartbeatAt: null,
  startedAt: '2024-06-01T12:00:00Z',
  completedAt: '2024-06-01T12:05:00Z',
};

function setupFetchMock(overrides: Record<string, () => Promise<Response>> = {}) {
  const defaults: Record<string, () => Promise<Response>> = {
    '/api/repos/repo-1': () => jsonResponse(mockRepo),
    '/api/repos/repo-1/settings': () => jsonResponse(mockSettings),
    '/api/repos/repo-1/status': () => jsonResponse(mockJob),
  };
  const handlers = { ...defaults, ...overrides };

  global.fetch = vi.fn((input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const handler = handlers[url];
    if (handler) return handler();
    return jsonResponse({ error: 'Not found' }, 404);
  }) as unknown as typeof fetch;
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map(), shouldRetryOnError: false }}>
      {children}
    </SWRConfig>
  );
}

beforeEach(() => {
  setupFetchMock();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('useRepoDetail', () => {
  it('fetches repo data from /api/repos/:id', async () => {
    const { result } = renderHook(() => useRepoDetail('repo-1'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(global.fetch).toHaveBeenCalledWith('/api/repos/repo-1');
    expect(result.current.repo).toEqual(mockRepo);
  });

  it('fetches settings from /api/repos/:id/settings', async () => {
    const { result } = renderHook(() => useRepoDetail('repo-1'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(global.fetch).toHaveBeenCalledWith('/api/repos/repo-1/settings');
    expect(result.current.settings).toEqual(mockSettings);
  });

  it('fetches latest job from /api/repos/:id/status', async () => {
    const { result } = renderHook(() => useRepoDetail('repo-1'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(global.fetch).toHaveBeenCalledWith('/api/repos/repo-1/status');
    expect(result.current.latestJob).toEqual(mockJob);
  });

  it('returns combined data with all fields', async () => {
    const { result } = renderHook(() => useRepoDetail('repo-1'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.repo).toBeDefined();
    expect(result.current.settings).toBeDefined();
    expect(result.current.latestJob).toBeDefined();
    expect(result.current.error).toBeUndefined();
  });

  it('returns isLoading true while fetching', () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;

    const { result } = renderHook(() => useRepoDetail('repo-1'), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it('normalizes { status: "none" } to null for latestJob', async () => {
    setupFetchMock({
      '/api/repos/repo-1/status': () => jsonResponse({ status: 'none' }),
    });

    const { result } = renderHook(() => useRepoDetail('repo-1'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.latestJob).toBeNull();
  });

  it('handles 404 error for repo', async () => {
    setupFetchMock({
      '/api/repos/repo-1': () => jsonResponse({ error: 'Not found' }, 404),
    });

    const { result } = renderHook(() => useRepoDetail('repo-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
      expect(result.current.error).toBeInstanceOf(FetchError);
    });
  });
});
