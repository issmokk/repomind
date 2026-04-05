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

const mockListWebhooks = vi.fn()
const mockCreateWebhook = vi.fn()
const mockDeleteWebhook = vi.fn()

vi.mock('@/lib/github', () => ({
  createGitHubAuth: vi.fn(() => ({ getHeaders: vi.fn() })),
  GitHubClient: class {
    listWebhooks = mockListWebhooks
    createWebhook = mockCreateWebhook
    deleteWebhook = mockDeleteWebhook
  },
}))

vi.mock('@/lib/github/webhook-url', () => ({
  getWebhookUrl: vi.fn(() => 'https://repomind.example.com/api/webhooks/github'),
}))

const params = Promise.resolve({ id: 'repo-1' })

describe('GET /api/repos/[id]/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('GITHUB_APP_WEBHOOK_SECRET', 'test-secret')
    mockListWebhooks.mockResolvedValue([])
  })

  async function callGet() {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/repos/repo-1/webhook')
    return GET(req, { params })
  }

  it('returns webhook URL and secret status', async () => {
    const res = await callGet()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.webhookUrl).toBe('https://repomind.example.com/api/webhooks/github')
    expect(data.secretConfigured).toBe(true)
    expect(data.existingHook).toBeNull()
  })

  it('detects existing webhook', async () => {
    mockListWebhooks.mockResolvedValue([
      { id: 42, config: { url: 'https://repomind.example.com/api/webhooks/github' }, events: ['push'], active: true },
    ])
    const res = await callGet()
    const data = await res.json()
    expect(data.existingHook).toEqual({ id: 42, active: true })
  })

  it('handles listWebhooks failure gracefully', async () => {
    mockListWebhooks.mockRejectedValue(new Error('403 Forbidden'))
    const res = await callGet()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.existingHook).toBeNull()
  })
})

describe('POST /api/repos/[id]/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('GITHUB_APP_WEBHOOK_SECRET', 'test-secret')
    mockListWebhooks.mockResolvedValue([])
    mockCreateWebhook.mockResolvedValue({ id: 99, config: { url: 'https://repomind.example.com/api/webhooks/github' }, events: ['push'], active: true })
  })

  async function callPost() {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/repos/repo-1/webhook', { method: 'POST' })
    return POST(req, { params })
  }

  it('creates a webhook and returns hookId', async () => {
    const res = await callPost()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.hookId).toBe(99)
    expect(data.alreadyExists).toBe(false)
  })

  it('returns alreadyExists when webhook is already configured', async () => {
    mockListWebhooks.mockResolvedValue([
      { id: 42, config: { url: 'https://repomind.example.com/api/webhooks/github' }, events: ['push'], active: true },
    ])
    const res = await callPost()
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.hookId).toBe(42)
    expect(data.alreadyExists).toBe(true)
    expect(mockCreateWebhook).not.toHaveBeenCalled()
  })

  it('returns 500 when webhook secret is not configured', async () => {
    vi.stubEnv('GITHUB_APP_WEBHOOK_SECRET', '')
    const res = await callPost()
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('GITHUB_APP_WEBHOOK_SECRET')
  })

  it('returns 403 when insufficient permissions', async () => {
    mockCreateWebhook.mockRejectedValue(new Error('GitHub API error 404: not found'))
    const res = await callPost()
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('insufficient permissions')
  })
})

describe('DELETE /api/repos/[id]/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListWebhooks.mockResolvedValue([
      { id: 42, config: { url: 'https://repomind.example.com/api/webhooks/github' }, events: ['push'], active: true },
    ])
    mockDeleteWebhook.mockResolvedValue(undefined)
  })

  async function callDelete() {
    const { DELETE } = await import('./route')
    const req = new NextRequest('http://localhost/api/repos/repo-1/webhook', { method: 'DELETE' })
    return DELETE(req, { params })
  }

  it('deletes matching webhook', async () => {
    const res = await callDelete()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(mockDeleteWebhook).toHaveBeenCalledWith('owner', 'repo', 42)
  })

  it('returns ok when no matching webhook found', async () => {
    mockListWebhooks.mockResolvedValue([])
    const res = await callDelete()
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(mockDeleteWebhook).not.toHaveBeenCalled()
  })
})
