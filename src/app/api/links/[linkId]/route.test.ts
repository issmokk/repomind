// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

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

vi.mock('@/lib/storage/supabase', () => ({
  SupabaseStorageProvider: class { constructor() { return {} } },
}))

function chainMock(data: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn(async () => ({ data, error })),
    maybeSingle: vi.fn(async () => ({ data, error })),
  }
  ;(chain as Record<string, unknown>).then = async (resolve: (v: unknown) => void) => resolve({ data, error })
  return chain
}

const linkRow = { id: 'link-1', org_id: 'org-1', name: 'Test Link', created_at: '2024-01-01', updated_at: '2024-01-01' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PUT /api/links/[linkId]', () => {
  it('updates link group name', async () => {
    const updatedLink = { ...linkRow, name: 'Renamed' }
    let callIdx = 0
    mockFrom.mockImplementation(() => {
      callIdx++
      if (callIdx <= 2) return chainMock(linkRow)
      if (callIdx === 3) return chainMock(updatedLink)
      return chainMock([])
    })

    const { PUT } = await import('./route')
    const req = new Request('http://localhost/api/links/link-1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Renamed' }),
      headers: { 'Content-Type': 'application/json' },
    }) as never
    const res = await PUT(req, { params: Promise.resolve({ linkId: 'link-1' }) })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe('Renamed')
  })

  it('returns 404 for nonexistent link group', async () => {
    mockFrom.mockImplementation(() => chainMock(null))

    const { PUT } = await import('./route')
    const req = new Request('http://localhost/api/links/nonexistent', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    }) as never
    const res = await PUT(req, { params: Promise.resolve({ linkId: 'nonexistent' }) })
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'not authenticated' },
    })

    const { PUT } = await import('./route')
    const req = new Request('http://localhost/api/links/link-1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    }) as never
    const res = await PUT(req, { params: Promise.resolve({ linkId: 'link-1' }) })
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/links/[linkId]', () => {
  it('deletes link group and returns 204', async () => {
    let callIdx = 0
    mockFrom.mockImplementation(() => {
      callIdx++
      if (callIdx === 1) return chainMock({ id: 'link-1' })
      return chainMock(null)
    })

    const { DELETE } = await import('./route')
    const req = new Request('http://localhost/api/links/link-1', { method: 'DELETE' }) as never
    const res = await DELETE(req, { params: Promise.resolve({ linkId: 'link-1' }) })
    expect(res.status).toBe(204)
  })

  it('returns 404 for nonexistent link group', async () => {
    mockFrom.mockImplementation(() => chainMock(null))

    const { DELETE } = await import('./route')
    const req = new Request('http://localhost/api/links/nonexistent', { method: 'DELETE' }) as never
    const res = await DELETE(req, { params: Promise.resolve({ linkId: 'nonexistent' }) })
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'not authenticated' },
    })

    const { DELETE } = await import('./route')
    const req = new Request('http://localhost/api/links/link-1', { method: 'DELETE' }) as never
    const res = await DELETE(req, { params: Promise.resolve({ linkId: 'link-1' }) })
    expect(res.status).toBe(401)
  })
})
