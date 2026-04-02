// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockSupabase = {
  auth: {
    getUser: vi.fn(async () => ({
      data: { user: { id: 'user-1', app_metadata: { org_id: 'org-1' } } },
      error: null,
    })),
  },
  from: mockFrom,
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('@/lib/storage/supabase', () => ({
  SupabaseStorageProvider: class { constructor() { return mockStorage } },
}))

const mockStorage = {
  getRepository: vi.fn(async (id: string) => {
    if (id === 'repo-1') return { id: 'repo-1', name: 'repo1', fullName: 'org/repo1', orgId: 'org-1' }
    if (id === 'repo-2') return { id: 'repo-2', name: 'repo2', fullName: 'org/repo2', orgId: 'org-1' }
    return null
  }),
}

function chainMock(data: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn(async () => ({ data, error })),
    maybeSingle: vi.fn(async () => ({ data, error })),
  }
  ;(chain as Record<string, unknown>).then = async (resolve: (v: unknown) => void) => resolve({ data, error })
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/repos/[id]/links', () => {
  it('returns link groups for the repo', async () => {
    let callIdx = 0
    mockFrom.mockImplementation((table: string) => {
      callIdx++
      if (table === 'repo_link_memberships' && callIdx === 1) {
        return chainMock([{ link_id: 'link-1' }])
      }
      if (table === 'repo_links') {
        return chainMock([{ id: 'link-1', org_id: 'org-1', name: 'Test Group', created_at: '2024-01-01', updated_at: '2024-01-01' }])
      }
      if (table === 'repo_link_memberships') {
        return chainMock([
          { id: 'mem-1', link_id: 'link-1', repo_id: 'repo-1', created_at: '2024-01-01' },
          { id: 'mem-2', link_id: 'link-1', repo_id: 'repo-2', created_at: '2024-01-01' },
        ])
      }
      return chainMock(null)
    })

    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/repos/repo-1/links') as never
    const res = await GET(req, { params: Promise.resolve({ id: 'repo-1' }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
  })

  it('returns empty array when repo has no link groups', async () => {
    mockFrom.mockImplementation(() => chainMock([]))

    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/repos/repo-1/links') as never
    const res = await GET(req, { params: Promise.resolve({ id: 'repo-1' }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual([])
  })

  it('returns 401 when unauthenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'not authenticated' },
    })

    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/repos/repo-1/links') as never
    const res = await GET(req, { params: Promise.resolve({ id: 'repo-1' }) })
    expect(res.status).toBe(401)
  })
})

describe('POST /api/repos/[id]/links', () => {
  it('creates a link group with memberships', async () => {
    const createdLink = { id: 'link-new', org_id: 'org-1', name: 'New Group', created_at: '2024-01-01', updated_at: '2024-01-01' }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'repo_links') {
        return chainMock(createdLink)
      }
      if (table === 'repo_link_memberships') {
        return chainMock([])
      }
      return chainMock(null)
    })

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/repos/repo-1/links', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Group', repoIds: ['repo-2'] }),
      headers: { 'Content-Type': 'application/json' },
    }) as never
    const res = await POST(req, { params: Promise.resolve({ id: 'repo-1' }) })
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.name).toBe('New Group')
    expect(data.repoIds).toContain('repo-1')
    expect(data.repoIds).toContain('repo-2')
  })

  it('returns 400 when name is missing', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/repos/repo-1/links', {
      method: 'POST',
      body: JSON.stringify({ repoIds: ['repo-2'] }),
      headers: { 'Content-Type': 'application/json' },
    }) as never
    const res = await POST(req, { params: Promise.resolve({ id: 'repo-1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'not authenticated' },
    })

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/repos/repo-1/links', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', repoIds: [] }),
      headers: { 'Content-Type': 'application/json' },
    }) as never
    const res = await POST(req, { params: Promise.resolve({ id: 'repo-1' }) })
    expect(res.status).toBe(401)
  })
})
