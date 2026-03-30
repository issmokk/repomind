// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import type { NextRequest } from 'next/server';

const mockJob = {
  id: 'job-1',
  repoId: 'repo-1',
  status: 'processing',
  processedFiles: 10,
  totalFiles: 100,
  failedFiles: 0,
  currentFile: 'src/index.ts',
  errorLog: [],
  startedAt: '2024-01-01T00:00:00Z',
  completedAt: null,
};

const _completedJob = {
  ...mockJob,
  status: 'completed',
  processedFiles: 100,
  completedAt: '2024-01-01T00:05:00Z',
  currentFile: null,
};

let callCount = 0;
const mockStorage = {
  getActiveJob: vi.fn(() => Promise.resolve(mockJob)),
  getLatestJob: vi.fn(() => Promise.resolve(null)),
  getRepository: vi.fn(() =>
    Promise.resolve({ id: 'repo-1', orgId: 'org-1', name: 'test', fullName: 'test/test' }),
  ),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: () =>
          Promise.resolve({
            data: { user: { id: 'user-1', app_metadata: { org_id: 'org-1' } } },
            error: null,
          }),
      },
    }),
  ),
}));

vi.mock('@/lib/storage/supabase', () => ({
  SupabaseStorageProvider: class {
    getActiveJob = mockStorage.getActiveJob;
    getLatestJob = mockStorage.getLatestJob;
    getRepository = mockStorage.getRepository;
  },
}));

vi.mock('@/lib/indexer/pipeline', () => ({
  checkAndMarkStaleJob: vi.fn(async () => {
    callCount++;
    if (callCount === 1) return mockJob;
    if (callCount === 2) return { ...mockJob, processedFiles: 20 };
    return null;
  }),
}));

function createRequest(_repoId: string): NextRequest {
  const controller = new AbortController();
  return {
    signal: controller.signal,
  } as unknown as NextRequest;
}

beforeEach(() => {
  callCount = 0;
  vi.clearAllMocks();
});

describe('SSE stream route', () => {
  it('returns correct Content-Type header', async () => {
    const request = createRequest('repo-1');
    const params = Promise.resolve({ id: 'repo-1' });

    const response = await GET(request, { params });

    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
  });

  it('returns 401 for unauthenticated requests', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: {
        getUser: () => Promise.resolve({ data: { user: null }, error: new Error('No auth') }),
      },
    } as never);

    const request = createRequest('repo-1');
    const params = Promise.resolve({ id: 'repo-1' });

    const response = await GET(request, { params });

    expect(response.status).toBe(401);
  });

  it('sends job-update events when job state changes', async () => {
    const request = createRequest('repo-1');
    const params = Promise.resolve({ id: 'repo-1' });

    const response = await GET(request, { params });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    const { value: chunk1 } = await reader.read();
    const text1 = decoder.decode(chunk1);
    expect(text1).toContain('event: job-update');
    expect(text1).toContain('"processedFiles":10');

    reader.cancel();
  });
});
