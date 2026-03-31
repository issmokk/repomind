// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'user-1', app_metadata: { org_id: 'org-1' } } },
        error: null,
      })),
    },
  })),
}))

vi.mock('@/lib/storage/supabase', () => {
  return {
    SupabaseStorageProvider: class { constructor() { return mockStorage } },
  }
})

vi.mock('@/lib/github', () => ({
  PersonalAccessTokenAuth: class {},
  GitHubClient: class {
    getRepoMetadata = vi.fn(async () => ({
      name: 'repo', fullName: 'owner/repo', defaultBranch: 'main', url: 'https://github.com/owner/repo', private: false,
    }))
  },
  GitHubFileCache: class {},
}))

vi.mock('@/lib/indexer/embedding', () => ({
  createEmbeddingProvider: vi.fn(() => ({ name: 'mock', dimensions: 1536, validateDimensions: vi.fn(async () => {}) })),
}))

vi.mock('@/lib/indexer/pipeline', () => ({
  startIndexingJob: vi.fn(async () => ({ id: 'job-1', status: 'processing', processedFiles: 0, totalFiles: 5 })),
  processNextBatch: vi.fn(async () => ({ job: { id: 'job-1', status: 'processing', processedFiles: 2, totalFiles: 5 }, hasMore: true })),
  checkAndMarkStaleJob: vi.fn(async () => null),
  PipelineError: class extends Error { statusCode: number; constructor(msg: string, code: number) { super(msg); this.statusCode = code } },
}))

const mockStorage = {
  createRepository: vi.fn(async (data: Record<string, unknown>) => ({ id: 'repo-1', ...data })),
  getRepositories: vi.fn(async () => [{ id: 'repo-1', name: 'repo', fullName: 'owner/repo' }]),
  getRepository: vi.fn(async () => ({ id: 'repo-1', name: 'repo', fullName: 'owner/repo' })),
  deleteRepository: vi.fn(async () => {}),
  getLatestJob: vi.fn(async () => ({ id: 'job-1', status: 'completed' })),
  getActiveJob: vi.fn(async () => null),
  getSettings: vi.fn(async () => ({
    id: 's-1', repoId: 'repo-1', branchFilter: ['main'], includePatterns: [], excludePatterns: [],
    embeddingProvider: 'ollama', embeddingModel: 'gte-qwen2-1.5b-instruct', autoIndexOnAdd: false,
  })),
  updateSettings: vi.fn(async (_id: string, data: Record<string, unknown>) => ({ id: 's-1', ...data })),
  createDefaultSettings: vi.fn(async () => ({})),
  getTeamSettingsDecrypted: vi.fn(async () => ({
    embeddingProvider: 'ollama', ollamaModel: 'test-model', ollamaBaseUrl: 'http://localhost:11434',
    geminiApiKey: null, geminiEmbeddingModel: 'gemini-embedding-001',
    ollamaLlmModel: 'test', providerOrder: ['ollama'],
  })),
}

function makeRequest(method: string, body?: unknown, url = 'http://localhost/api/repos') {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }) as never
}

beforeEach(() => vi.clearAllMocks())

describe('POST /api/repos', () => {
  it('creates repository with valid credentials', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest('POST', { fullName: 'owner/repo' }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.fullName).toBe('owner/repo')
  })

  it('returns 400 for invalid fullName format', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest('POST', { fullName: 'invalid' }))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/repos', () => {
  it('returns repos with latest job status', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data[0].latestJobStatus).toBe('completed')
  })
})

describe('DELETE /api/repos/:id', () => {
  it('deletes repo', async () => {
    const { DELETE } = await import('./[id]/route')
    const res = await DELETE(makeRequest('DELETE'), { params: Promise.resolve({ id: 'repo-1' }) })
    expect(res.status).toBe(200)
    expect(mockStorage.deleteRepository).toHaveBeenCalledWith('repo-1')
  })

  it('returns 404 for repo not in org', async () => {
    mockStorage.getRepository.mockResolvedValueOnce(null)
    const { DELETE } = await import('./[id]/route')
    const res = await DELETE(makeRequest('DELETE'), { params: Promise.resolve({ id: 'bad-id' }) })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/repos/:id/index', () => {
  it('creates indexing job', async () => {
    const { POST } = await import('./[id]/index/route')
    const res = await POST(makeRequest('POST', {}), { params: Promise.resolve({ id: 'repo-1' }) })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.jobId).toBe('job-1')
  })

  it('returns 409 for PipelineError with 409 status', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { startIndexingJob } = await import('@/lib/indexer/pipeline')
    const { PipelineError } = await import('@/lib/indexer/pipeline')
    vi.mocked(startIndexingJob).mockRejectedValueOnce(new PipelineError('Already indexing', 409))

    const { POST } = await import('./[id]/index/route')
    const res = await POST(makeRequest('POST', {}), { params: Promise.resolve({ id: 'repo-1' }) })
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toBe('Already indexing')
  })

  it('returns 500 for unexpected errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { startIndexingJob } = await import('@/lib/indexer/pipeline')
    vi.mocked(startIndexingJob).mockRejectedValueOnce(new Error('Connection failed'))

    const { POST } = await import('./[id]/index/route')
    const res = await POST(makeRequest('POST', {}), { params: Promise.resolve({ id: 'repo-1' }) })
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('Connection failed')
  })

  it('returns 404 when repo not found', async () => {
    mockStorage.getRepository.mockResolvedValueOnce(null)
    const { POST } = await import('./[id]/index/route')
    const res = await POST(makeRequest('POST', {}), { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/repos/:id/index/process', () => {
  it('returns Retry-After header', async () => {
    mockStorage.getActiveJob.mockResolvedValueOnce({ id: 'job-1', status: 'processing' })
    const { POST } = await import('./[id]/index/process/route')
    const res = await POST(makeRequest('POST'), { params: Promise.resolve({ id: 'repo-1' }) })
    expect(res.headers.get('Retry-After')).toBe('2')
  })

  it('returns latest job when no active job', async () => {
    mockStorage.getActiveJob.mockResolvedValueOnce(null)
    const { POST } = await import('./[id]/index/process/route')
    const res = await POST(makeRequest('POST'), { params: Promise.resolve({ id: 'repo-1' }) })
    const data = await res.json()
    expect(data.status).toBe('completed')
  })

  it('returns status none when no active or latest job', async () => {
    mockStorage.getActiveJob.mockResolvedValueOnce(null)
    mockStorage.getLatestJob.mockResolvedValueOnce(null)
    const { POST } = await import('./[id]/index/process/route')
    const res = await POST(makeRequest('POST'), { params: Promise.resolve({ id: 'repo-1' }) })
    const data = await res.json()
    expect(data.status).toBe('none')
  })
})

describe('GET /api/repos/:id/status', () => {
  it('returns latest job', async () => {
    const { GET } = await import('./[id]/status/route')
    const res = await GET(makeRequest('GET'), { params: Promise.resolve({ id: 'repo-1' }) })
    const data = await res.json()
    expect(data.status).toBe('completed')
  })

  it('returns status none when no jobs exist', async () => {
    const { checkAndMarkStaleJob } = await import('@/lib/indexer/pipeline')
    vi.mocked(checkAndMarkStaleJob).mockResolvedValueOnce(null)
    mockStorage.getLatestJob.mockResolvedValueOnce(null)

    const { GET } = await import('./[id]/status/route')
    const res = await GET(makeRequest('GET'), { params: Promise.resolve({ id: 'repo-1' }) })
    const data = await res.json()
    expect(data.status).toBe('none')
  })

  it('returns active job when stale check finds one', async () => {
    const { checkAndMarkStaleJob } = await import('@/lib/indexer/pipeline')
    vi.mocked(checkAndMarkStaleJob).mockResolvedValueOnce({ id: 'job-1', status: 'processing', processedFiles: 5, totalFiles: 10 } as never)

    const { GET } = await import('./[id]/status/route')
    const res = await GET(makeRequest('GET'), { params: Promise.resolve({ id: 'repo-1' }) })
    const data = await res.json()
    expect(data.status).toBe('processing')
  })
})

describe('GET /api/repos/:id/settings', () => {
  it('returns settings', async () => {
    const { GET } = await import('./[id]/settings/route')
    const res = await GET(makeRequest('GET'), { params: Promise.resolve({ id: 'repo-1' }) })
    const data = await res.json()
    expect(data.embeddingProvider).toBe('ollama')
  })

  it('returns 404 when settings not found', async () => {
    mockStorage.getSettings.mockResolvedValueOnce(null)
    const { GET } = await import('./[id]/settings/route')
    const res = await GET(makeRequest('GET'), { params: Promise.resolve({ id: 'repo-1' }) })
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/repos/:id/settings', () => {
  it('updates settings', async () => {
    const { PUT } = await import('./[id]/settings/route')
    const res = await PUT(
      makeRequest('PUT', { branchFilter: ['main', 'develop'] }),
      { params: Promise.resolve({ id: 'repo-1' }) },
    )
    expect(res.status).toBe(200)
  })

  it('validates branchFilter is non-empty', async () => {
    const { PUT } = await import('./[id]/settings/route')
    const res = await PUT(
      makeRequest('PUT', { branchFilter: [] }),
      { params: Promise.resolve({ id: 'repo-1' }) },
    )
    expect(res.status).toBe(400)
  })

  it('validates embeddingProvider is known', async () => {
    const { PUT } = await import('./[id]/settings/route')
    const res = await PUT(
      makeRequest('PUT', { embeddingProvider: 'nonexistent' }),
      { params: Promise.resolve({ id: 'repo-1' }) },
    )
    expect(res.status).toBe(400)
  })

  it('validates includePatterns is array of strings', async () => {
    const { PUT } = await import('./[id]/settings/route')
    const res = await PUT(
      makeRequest('PUT', { includePatterns: 'not-array' }),
      { params: Promise.resolve({ id: 'repo-1' }) },
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/includePatterns/)
  })

  it('validates excludePatterns is array of strings', async () => {
    const { PUT } = await import('./[id]/settings/route')
    const res = await PUT(
      makeRequest('PUT', { excludePatterns: [123] }),
      { params: Promise.resolve({ id: 'repo-1' }) },
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/excludePatterns/)
  })

  it('strips unknown fields from update', async () => {
    const { PUT } = await import('./[id]/settings/route')
    await PUT(
      makeRequest('PUT', { branchFilter: ['main'], hackerField: 'drop me' }),
      { params: Promise.resolve({ id: 'repo-1' }) },
    )
    expect(mockStorage.updateSettings).toHaveBeenCalledWith('repo-1', { branchFilter: ['main'] })
  })
})
