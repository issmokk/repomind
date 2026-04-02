// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockSend = vi.fn()
vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: mockSend },
}))

vi.mock('@octokit/auth-app', () => ({
  createAppAuth: vi.fn(() => vi.fn().mockResolvedValue({ token: 'test-token' })),
}))

const mockCreateRepository = vi.fn()

vi.mock('@/lib/storage/supabase', () => ({
  SupabaseStorageProvider: class {
    createRepository = mockCreateRepository
  },
}))

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

const mockGetInstallationRepos = vi.fn()
vi.mock('@/lib/github/app-auth', () => ({
  GitHubAppAuth: class {
    getInstallationRepos = mockGetInstallationRepos
  },
}))

describe('GET /api/github/install', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GITHUB_APP_ID = '12345'
    process.env.GITHUB_APP_PRIVATE_KEY = Buffer.from('test-key').toString('base64')
    mockGetInstallationRepos.mockResolvedValue([
      { name: 'repo1', fullName: 'org/repo1', defaultBranch: 'main', url: 'https://github.com/org/repo1', private: false },
    ])
    mockCreateRepository.mockResolvedValue({ id: 'repo-1' })
    mockSend.mockResolvedValue(undefined)
  })

  function makeRequest(params: Record<string, string> = {}) {
    const url = new URL('http://localhost/api/github/install')
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    return new NextRequest(url)
  }

  it('extracts installation_id and fetches repos', async () => {
    const { GET } = await import('./route')
    const res = await GET(makeRequest({ installation_id: '999' }))
    expect(res.status).toBe(307)
    expect(mockGetInstallationRepos).toHaveBeenCalled()
  })

  it('creates Repository records with github_auth_type="github_app"', async () => {
    const { GET } = await import('./route')
    await GET(makeRequest({ installation_id: '999' }))
    expect(mockCreateRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        githubAuthType: 'github_app',
        fullName: 'org/repo1',
      }),
    )
  })

  it('triggers Inngest indexing event for each repo', async () => {
    const { GET } = await import('./route')
    await GET(makeRequest({ installation_id: '999' }))
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'repo/index',
        data: expect.objectContaining({ repoId: 'repo-1', triggerType: 'install' }),
      }),
    )
  })

  it('redirects to dashboard after completion', async () => {
    const { GET } = await import('./route')
    const res = await GET(makeRequest({ installation_id: '999' }))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/dashboard')
  })

  it('handles missing installation_id', async () => {
    const { GET } = await import('./route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('error=missing_installation_id')
  })

  it('handles auth failure', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null }, error: new Error('No auth') })),
      },
    } as never)

    const { GET } = await import('./route')
    const res = await GET(makeRequest({ installation_id: '999' }))
    expect(res.status).toBe(401)
  })
})
