// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockIn = vi.fn()
const mockOr = vi.fn()
const mockLimit = vi.fn()

function chainable() {
  return { select: mockSelect, in: mockIn, or: mockOr, limit: mockLimit }
}

const mockFrom = vi.fn(() => chainable())

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'user-1', app_metadata: { org_id: 'org-1' } } },
        error: null,
      })),
    },
    from: mockFrom,
  })),
}))

vi.mock('@/lib/storage/supabase', () => ({
  SupabaseStorageProvider: class {},
}))

vi.mock('@/lib/indexer/embedding', () => ({
  createEmbeddingProvider: vi.fn(),
}))

const sampleEdges = [
  {
    id: 1, repo_id: 'repo-1', source_file: 'a.ts', source_symbol: 'funcA', source_type: 'function',
    target_file: 'b.ts', target_symbol: 'funcB', target_type: 'function',
    relationship_type: 'calls', metadata: {}, created_at: '2025-01-01',
  },
  {
    id: 2, repo_id: 'repo-1', source_file: 'a.ts', source_symbol: 'funcA', source_type: 'function',
    target_file: 'c.ts', target_symbol: 'ClassC', target_type: 'class',
    relationship_type: 'imports', metadata: {}, created_at: '2025-01-01',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockSelect.mockReturnValue(chainable())
  mockIn.mockReturnValue(chainable())
  mockOr.mockReturnValue(chainable())
  mockLimit.mockResolvedValue({ data: sampleEdges, error: null })
})

function makeRequest(query = '') {
  const url = `http://localhost/api/graph${query ? '?' + query : ''}`
  const req = new Request(url)
  Object.defineProperty(req, 'nextUrl', { value: new URL(url) })
  return req as never
}

describe('GET /api/graph', () => {
  it('returns edges filtered by repoIds', async () => {
    const { GET } = await import('./route')
    const res = await GET(makeRequest('repoIds=repo-1,repo-2'))
    expect(res.status).toBe(200)
    expect(mockIn).toHaveBeenCalledWith('repo_id', ['repo-1', 'repo-2'])
  })

  it('returns edges filtered by symbolTypes', async () => {
    const { GET } = await import('./route')
    await GET(makeRequest('symbolTypes=function,class'))
    expect(mockOr).toHaveBeenCalledWith(
      expect.stringContaining('source_type.eq.function'),
    )
  })

  it('returns edges filtered by relationshipTypes', async () => {
    const { GET } = await import('./route')
    await GET(makeRequest('relationshipTypes=calls,imports'))
    expect(mockIn).toHaveBeenCalledWith('relationship_type', ['calls', 'imports'])
  })

  it('topConnected parameter returns most-connected nodes', async () => {
    const { GET } = await import('./route')
    const res = await GET(makeRequest('topConnected=1'))
    const data = await res.json()
    expect(data.edges.length).toBeGreaterThan(0)
    expect(mockLimit).toHaveBeenCalledWith(5000)
  })

  it('nodeId parameter returns neighborhood edges', async () => {
    const { GET } = await import('./route')
    await GET(makeRequest('nodeId=funcA'))
    expect(mockOr).toHaveBeenCalledWith('source_symbol.eq.funcA,target_symbol.eq.funcA')
  })

  it('returns correct nodeCount and edgeCount', async () => {
    mockLimit.mockResolvedValueOnce({
      data: [
        { id: 1, source_file: 'a.ts', source_symbol: 'A', target_file: 'b.ts', target_symbol: 'B', source_type: 'function', target_type: 'function', relationship_type: 'calls', repo_id: 'r1', metadata: {}, created_at: '' },
        { id: 2, source_file: 'a.ts', source_symbol: 'A', target_file: 'c.ts', target_symbol: 'C', source_type: 'function', target_type: 'class', relationship_type: 'calls', repo_id: 'r1', metadata: {}, created_at: '' },
        { id: 3, source_file: 'b.ts', source_symbol: 'B', target_file: 'c.ts', target_symbol: 'C', source_type: 'function', target_type: 'class', relationship_type: 'imports', repo_id: 'r1', metadata: {}, created_at: '' },
        { id: 4, source_file: 'c.ts', source_symbol: 'C', target_file: 'd.ts', target_symbol: 'D', source_type: 'class', target_type: 'module', relationship_type: 'inherits', repo_id: 'r1', metadata: {}, created_at: '' },
        { id: 5, source_file: 'd.ts', source_symbol: 'D', target_file: 'a.ts', target_symbol: 'A', source_type: 'module', target_type: 'function', relationship_type: 'depends_on', repo_id: 'r1', metadata: {}, created_at: '' },
      ],
      error: null,
    })
    const { GET } = await import('./route')
    const res = await GET(makeRequest())
    const data = await res.json()
    expect(data.nodeCount).toBe(4)
    expect(data.edgeCount).toBe(5)
  })

  it('returns 401 for unauthenticated requests', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: new Error('no auth') })) },
    } as never)

    const { GET } = await import('./route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('respects limit parameter', async () => {
    const { GET } = await import('./route')
    await GET(makeRequest('limit=10'))
    expect(mockLimit).toHaveBeenCalledWith(10)
  })

  it('defaults limit to 500', async () => {
    const { GET } = await import('./route')
    await GET(makeRequest())
    expect(mockLimit).toHaveBeenCalledWith(500)
  })
})
