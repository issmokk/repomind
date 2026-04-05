// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockRepo = {
  id: 'repo-1',
  fullName: 'owner/repo',
  defaultBranch: 'main',
  lastIndexedCommit: 'abc1234',
  githubAuthType: 'pat' as const,
  githubAppInstallationId: null,
}

vi.mock('../../_helpers', () => ({
  getRepoContext: vi.fn(() => ({
    userId: 'user-1',
    orgId: 'org-1',
    supabase: {},
    storage: {},
    repo: mockRepo,
  })),
}))

const mockGetCommitsBehind = vi.fn()

vi.mock('@/lib/github', () => ({
  createGitHubAuth: vi.fn(() => ({ getHeaders: vi.fn() })),
  GitHubClient: class {
    getCommitsBehind = mockGetCommitsBehind
  },
}))

describe('GET /api/repos/[id]/freshness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCommitsBehind.mockResolvedValue({ behind: 3, headSha: 'def5678' })
  })

  async function callGet() {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/repos/repo-1/freshness')
    return GET(req, { params: Promise.resolve({ id: 'repo-1' }) })
  }

  it('returns behind count and commit SHAs', async () => {
    const res = await callGet()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.behind).toBe(3)
    expect(data.lastIndexedCommit).toBe('abc1234')
    expect(data.headSha).toBe('def5678')
  })

  it('calls getCommitsBehind with correct owner/repo/base/head', async () => {
    await callGet()
    expect(mockGetCommitsBehind).toHaveBeenCalledWith('owner', 'repo', 'abc1234', 'main')
  })

  it('returns behind: null when lastIndexedCommit is null', async () => {
    const { getRepoContext } = await import('../../_helpers')
    vi.mocked(getRepoContext).mockResolvedValueOnce({
      userId: 'user-1',
      orgId: 'org-1',
      supabase: {} as never,
      storage: {} as never,
      repo: { ...mockRepo, lastIndexedCommit: null } as never,
    })

    const res = await callGet()
    const data = await res.json()
    expect(data.behind).toBeNull()
    expect(data.lastIndexedCommit).toBeNull()
    expect(mockGetCommitsBehind).not.toHaveBeenCalled()
  })

  it('returns stale: true when commit no longer exists (404)', async () => {
    mockGetCommitsBehind.mockRejectedValueOnce(
      new Error('Repository not found or not accessible with current credentials'),
    )
    const res = await callGet()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.stale).toBe(true)
    expect(data.behind).toBeNull()
    expect(data.lastIndexedCommit).toBe('abc1234')
  })

  it('returns 502 when GitHub API fails with non-404 error', async () => {
    mockGetCommitsBehind.mockRejectedValueOnce(new Error('GitHub API error 500: internal'))
    const res = await callGet()
    expect(res.status).toBe(502)
  })
})
