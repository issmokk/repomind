// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CrossRepoEdge } from '@/lib/cross-repo/types'

const mockFrom = vi.fn()
const mockSupabase = {
  auth: {
    getUser: vi.fn(async () => ({
      data: { user: { id: 'user-1', app_metadata: { org_id: 'org-1' } } as { id: string; app_metadata: { org_id: string } } | null },
      error: null as { message: string } | null,
    })),
  },
  from: mockFrom,
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('@/lib/storage/supabase', () => {
  return {
    SupabaseStorageProvider: class {
      constructor() { return mockStorage }
    },
  }
})

vi.mock('@/lib/github', () => ({
  PersonalAccessTokenAuth: class {},
  GitHubClient: class {},
}))

vi.mock('@/lib/cross-repo/analyzer-registry', () => ({
  defaultRegistry: mockRegistry,
}))

const mockStorage = {
  getRepository: vi.fn(async (id: string) => repoMap[id] ?? null),
  deleteCrossRepoEdges: vi.fn(async () => {}),
  upsertEdges: vi.fn(async () => {}),
}

const mockRegistry = {
  runAll: vi.fn(async (): Promise<CrossRepoEdge[]> => []),
}

function setupSupabaseChain(data: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({ data, error })),
  }
  return chain
}

function makeRequest() {
  return new Request('http://localhost/api/links/link-1/analyze', { method: 'POST' }) as never
}

const linkRow = { id: 'link-1', org_id: 'org-1', name: 'Test Link' }
const membershipRows = [{ repo_id: 'repo-1' }, { repo_id: 'repo-2' }]

const repo1 = {
  id: 'repo-1', orgId: 'org-1', name: 'repo1', fullName: 'org/repo1', url: 'https://github.com/org/repo1',
  defaultBranch: 'main', lastIndexedCommit: 'abc123', githubAuthType: 'pat' as const,
  githubAppInstallationId: null, createdAt: '2024-01-01', updatedAt: '2024-01-01',
}
const repo2 = {
  id: 'repo-2', orgId: 'org-1', name: 'repo2', fullName: 'org/repo2', url: 'https://github.com/org/repo2',
  defaultBranch: 'main', lastIndexedCommit: 'def456', githubAuthType: 'pat' as const,
  githubAppInstallationId: null, createdAt: '2024-01-01', updatedAt: '2024-01-01',
}
const repo3Unindexed = {
  id: 'repo-3', orgId: 'org-1', name: 'repo3', fullName: 'org/repo3', url: 'https://github.com/org/repo3',
  defaultBranch: 'main', lastIndexedCommit: null, githubAuthType: 'pat' as const,
  githubAppInstallationId: null, createdAt: '2024-01-01', updatedAt: '2024-01-01',
}

const repoMap: Record<string, typeof repo1 | typeof repo3Unindexed> = {
  'repo-1': repo1,
  'repo-2': repo2,
  'repo-3': repo3Unindexed,
}

function setupDefaultMocks() {
  let callCount = 0
  mockFrom.mockImplementation(() => {
    callCount++
    if (callCount === 1) return setupSupabaseChain(linkRow)
    if (callCount === 2) {
      const chain = setupSupabaseChain(null)
      chain.maybeSingle = undefined as never
      ;(chain as Record<string, unknown>).then = async (resolve: (v: unknown) => void) => resolve({ data: membershipRows, error: null })
      return chain
    }
    return setupSupabaseChain(null)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/links/[linkId]/analyze', () => {
  it('loads repos in the link group, runs analyzers, stores edges', async () => {
    setupDefaultMocks()
    mockRegistry.runAll.mockResolvedValueOnce([
      {
        sourceRepoId: 'repo-1', sourceFile: 'Gemfile', sourceSymbol: 'wt_core',
        targetRepoId: 'repo-2', targetFile: null, targetSymbol: 'wt_core',
        relationshipType: 'gem_dependency', metadata: {}, confidence: 0.95,
      },
    ])

    const { POST } = await import('./route')
    const res = await POST(makeRequest(), { params: Promise.resolve({ linkId: 'link-1' }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.edgeCount).toBe(1)
    expect(data.byType.gem_dependency).toBe(1)
    expect(mockStorage.upsertEdges).toHaveBeenCalledWith([
      expect.objectContaining({
        repoId: 'repo-1',
        targetRepoId: 'repo-2',
        relationshipType: 'gem_dependency',
      }),
    ])
  })

  it('deletes existing cross-repo edges for link group before inserting', async () => {
    setupDefaultMocks()
    mockRegistry.runAll.mockResolvedValueOnce([
      {
        sourceRepoId: 'repo-1', sourceFile: 'Gemfile', sourceSymbol: 'dep',
        targetRepoId: 'repo-2', targetFile: null, targetSymbol: 'dep',
        relationshipType: 'gem_dependency', metadata: {}, confidence: 0.8,
      },
    ])

    const { POST } = await import('./route')
    await POST(makeRequest(), { params: Promise.resolve({ linkId: 'link-1' }) })

    const deleteCall = mockStorage.deleteCrossRepoEdges.mock.invocationCallOrder[0]
    const upsertCall = mockStorage.upsertEdges.mock.invocationCallOrder[0]
    expect(deleteCall).toBeLessThan(upsertCall)
    expect(mockStorage.deleteCrossRepoEdges).toHaveBeenCalledWith(['repo-1', 'repo-2'])
  })

  it('stores edges in graph_edges with target_repo_id populated', async () => {
    setupDefaultMocks()
    mockRegistry.runAll.mockResolvedValueOnce([
      {
        sourceRepoId: 'repo-1', sourceFile: 'src/index.ts', sourceSymbol: 'publish',
        targetRepoId: 'repo-2', targetFile: 'src/consumer.ts', targetSymbol: 'subscribe',
        relationshipType: 'event_publish', metadata: { event: 'order.created' }, confidence: 0.7,
      },
    ])

    const { POST } = await import('./route')
    await POST(makeRequest(), { params: Promise.resolve({ linkId: 'link-1' }) })

    const insertedEdges = (mockStorage.upsertEdges as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { targetRepoId: string }[]
    expect(insertedEdges[0].targetRepoId).toBe('repo-2')
    expect(insertedEdges[0].targetRepoId).not.toBeNull()
  })

  it('handles partially indexed repos (skips unindexed)', async () => {
    const membershipsWith3 = [{ repo_id: 'repo-1' }, { repo_id: 'repo-2' }, { repo_id: 'repo-3' }]

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return setupSupabaseChain(linkRow)
      if (callCount === 2) {
        const chain = setupSupabaseChain(null)
        chain.maybeSingle = undefined as never
        ;(chain as Record<string, unknown>).then = async (resolve: (v: unknown) => void) => resolve({ data: membershipsWith3, error: null })
        return chain
      }
      return setupSupabaseChain(null)
    })

    mockRegistry.runAll.mockResolvedValueOnce([])

    const { POST } = await import('./route')
    const res = await POST(makeRequest(), { params: Promise.resolve({ linkId: 'link-1' }) })
    const data = await res.json()

    expect(data.skippedRepos).toContain('repo-3')
    const analyzedRepos = (mockRegistry.runAll as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { id: string }[]
    expect(analyzedRepos).toHaveLength(2)
    expect(analyzedRepos.map((r: { id: string }) => r.id)).not.toContain('repo-3')
  })

  it('returns 404 when link group does not exist', async () => {
    mockFrom.mockImplementation(() => setupSupabaseChain(null))

    const { POST } = await import('./route')
    const res = await POST(makeRequest(), { params: Promise.resolve({ linkId: 'nonexistent' }) })
    expect(res.status).toBe(404)
  })

  it('returns 401 when user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'not authenticated' },
    })

    const { POST } = await import('./route')
    const res = await POST(makeRequest(), { params: Promise.resolve({ linkId: 'link-1' }) })
    expect(res.status).toBe(401)
  })
})
