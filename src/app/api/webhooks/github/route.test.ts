// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createHmac } from 'crypto'

const WEBHOOK_SECRET = 'test-secret'

const mockSend = vi.fn()
vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: mockSend },
}))

const mockFindRepo = vi.fn()
const mockCreateJob = vi.fn()
const mockGetSettingsInternal = vi.fn()
vi.mock('@/lib/storage/supabase', () => ({
  SupabaseStorageProvider: class {
    findRepositoryByFullName = mockFindRepo
    createJob = mockCreateJob
    getSettingsInternal = mockGetSettingsInternal
  },
}))

function sign(body: string): string {
  return 'sha256=' + createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')
}

function makePushPayload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    ref: 'refs/heads/main',
    after: 'abc123',
    repository: { full_name: 'owner/repo', default_branch: 'main' },
    commits: [
      { added: ['src/new.ts'], modified: ['src/changed.ts'], removed: [] },
    ],
    ...overrides,
  })
}

function makeRequest(body: string, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/webhooks/github', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      'x-github-event': 'push',
      'x-github-delivery': 'delivery-123',
      ...headers,
    },
  })
}

describe('POST /api/webhooks/github', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GITHUB_APP_WEBHOOK_SECRET = WEBHOOK_SECRET
    mockFindRepo.mockResolvedValue({
      id: 'repo-1',
      fullName: 'owner/repo',
      defaultBranch: 'main',
      lastIndexedCommit: 'prev123',
    })
    mockCreateJob.mockResolvedValue({ id: 'job-1', status: 'pending' })
    mockGetSettingsInternal.mockResolvedValue({ indexingMethod: 'webhook' })
    mockSend.mockResolvedValue(undefined)
  })

  it('verifies HMAC-SHA256 signature (valid accepted)', async () => {
    const body = makePushPayload()
    const { POST } = await import('./route')
    const res = await POST(makeRequest(body, { 'x-hub-signature-256': sign(body) }))
    expect(res.status).toBe(200)
  })

  it('rejects invalid signature with 401', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest(makePushPayload(), { 'x-hub-signature-256': 'sha256=invalid' }))
    expect(res.status).toBe(401)
  })

  it('rejects missing signature with 401', async () => {
    const { POST } = await import('./route')
    const body = makePushPayload()
    const req = new NextRequest('http://localhost/api/webhooks/github', {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json', 'x-github-event': 'push' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('parses push event and extracts changed files', async () => {
    const body = makePushPayload()
    const { POST } = await import('./route')
    await POST(makeRequest(body, { 'x-hub-signature-256': sign(body) }))
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          changedFiles: expect.arrayContaining(['src/new.ts', 'src/changed.ts']),
        }),
      }),
    )
  })

  it('ignores non-default branch pushes', async () => {
    const body = makePushPayload({ ref: 'refs/heads/feature-branch' })
    const { POST } = await import('./route')
    const res = await POST(makeRequest(body, { 'x-hub-signature-256': sign(body) }))
    const data = await res.json()
    expect(data.skipped).toBe('non-default branch')
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('ignores pushes for unknown repos', async () => {
    mockFindRepo.mockResolvedValue(null)
    const body = makePushPayload()
    const { POST } = await import('./route')
    const res = await POST(makeRequest(body, { 'x-hub-signature-256': sign(body) }))
    const data = await res.json()
    expect(data.skipped).toBe('unknown repo')
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('triggers Inngest event with webhook trigger type', async () => {
    const body = makePushPayload()
    const { POST } = await import('./route')
    await POST(makeRequest(body, { 'x-hub-signature-256': sign(body) }))
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'repo/index',
        data: expect.objectContaining({
          repoId: 'repo-1',
          triggerType: 'webhook',
        }),
      }),
    )
  })

  it('skips repos with manual indexing method', async () => {
    mockGetSettingsInternal.mockResolvedValue({ indexingMethod: 'manual' })
    const body = makePushPayload()
    const { POST } = await import('./route')
    const res = await POST(makeRequest(body, { 'x-hub-signature-256': sign(body) }))
    const data = await res.json()
    expect(data.skipped).toBe('indexing method is manual, not webhook/git_diff')
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('processes repos with git_diff indexing method', async () => {
    mockGetSettingsInternal.mockResolvedValue({ indexingMethod: 'git_diff' })
    const body = makePushPayload()
    const { POST } = await import('./route')
    const res = await POST(makeRequest(body, { 'x-hub-signature-256': sign(body) }))
    expect(res.status).toBe(200)
    expect(mockSend).toHaveBeenCalled()
  })

  it('skips duplicate commit SHA', async () => {
    mockFindRepo.mockResolvedValue({
      id: 'repo-1',
      fullName: 'owner/repo',
      lastIndexedCommit: 'abc123',
    })
    const body = makePushPayload({ after: 'abc123' })
    const { POST } = await import('./route')
    const res = await POST(makeRequest(body, { 'x-hub-signature-256': sign(body) }))
    const data = await res.json()
    expect(data.skipped).toBe('duplicate commit')
    expect(mockSend).not.toHaveBeenCalled()
  })
})
