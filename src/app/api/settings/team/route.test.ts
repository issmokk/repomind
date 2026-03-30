// @vitest-environment node
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

const TEST_KEY = 'a'.repeat(64)

beforeAll(() => {
  process.env.GITHUB_TOKEN_ENCRYPTION_KEY = TEST_KEY
})

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

vi.mock('@/lib/indexer/embedding', () => ({
  createEmbeddingProvider: vi.fn(),
}))

const mockStorage = {
  getTeamSettings: vi.fn(),
  updateTeamSettings: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

function makeRequest(method: string, body?: unknown) {
  return new Request('http://localhost/api/settings/team', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }) as never
}

describe('GET /api/settings/team', () => {
  it('returns masked keys only', async () => {
    const { encrypt } = await import('@/lib/crypto')
    const encryptedKey = encrypt('sk-ant-real-key-abcd')

    mockStorage.getTeamSettings.mockResolvedValueOnce({
      id: 's1', orgId: 'org-1', claudeApiKey: encryptedKey, openaiApiKey: null, cohereApiKey: null,
      providerOrder: ['claude'], searchTopK: 10, maxGraphHops: 2, searchRrfK: 60,
    })

    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json()

    expect(data.claudeApiKey).toBe('****abcd')
    expect(data.claudeApiKey).not.toBe('sk-ant-real-key-abcd')
    expect(data.claudeApiKey).not.toBe(encryptedKey)
  })
})

describe('PUT /api/settings/team', () => {
  it('encrypts new API keys before storage', async () => {
    mockStorage.updateTeamSettings.mockResolvedValueOnce({
      id: 's1', claudeApiKey: 'encrypted', openaiApiKey: null, cohereApiKey: null,
      providerOrder: ['claude'],
    })

    const { PUT } = await import('./route')
    await PUT(makeRequest('PUT', { claudeApiKey: 'sk-ant-real-key' }))

    const call = mockStorage.updateTeamSettings.mock.calls[0]
    const savedKey = call[1].claudeApiKey as string
    expect(savedKey).not.toBe('sk-ant-real-key')
    expect(savedKey).toContain(':')

    const { decrypt } = await import('@/lib/crypto')
    expect(decrypt(savedKey)).toBe('sk-ant-real-key')
  })

  it('unchanged masked value preserves existing encrypted key', async () => {
    mockStorage.updateTeamSettings.mockResolvedValueOnce({
      id: 's1', claudeApiKey: 'encrypted', openaiApiKey: null, cohereApiKey: null,
    })

    const { PUT } = await import('./route')
    await PUT(makeRequest('PUT', { claudeApiKey: '****abcd', searchTopK: 15 }))

    const call = mockStorage.updateTeamSettings.mock.calls[0]
    expect(call[1]).not.toHaveProperty('claudeApiKey')
    expect(call[1].searchTopK).toBe(15)
  })
})
