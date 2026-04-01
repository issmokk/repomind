// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockStorage = {
  getActiveJob: vi.fn(),
  createJob: vi.fn(),
  updateJobStatus: vi.fn(),
}

const mockRepo = {
  id: 'repo-1',
  fullName: 'owner/repo',
  defaultBranch: 'main',
  lastIndexedCommit: null,
}

vi.mock('../../_helpers', () => ({
  getRepoContext: vi.fn(() => ({
    userId: 'user-1',
    orgId: 'org-1',
    supabase: {},
    storage: mockStorage,
    repo: mockRepo,
  })),
}))

const mockSend = vi.fn()
vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: mockSend },
}))

describe('POST /api/repos/[id]/index', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getActiveJob.mockResolvedValue(null)
    mockStorage.createJob.mockResolvedValue({ id: 'job-1', status: 'pending' })
    mockSend.mockResolvedValue(undefined)
  })

  async function callPost(body = {}) {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/repos/repo-1/index', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    return POST(req, { params: Promise.resolve({ id: 'repo-1' }) })
  }

  it('sends Inngest event with trigger type "manual"', async () => {
    const res = await callPost()
    expect(res.status).toBe(200)
    expect(mockSend).toHaveBeenCalledWith({
      name: 'repo/index',
      data: { repoId: 'repo-1', jobId: 'job-1', triggerType: 'manual' },
    })
  })

  it('returns job ID immediately (non-blocking)', async () => {
    const res = await callPost()
    const data = await res.json()
    expect(data.jobId).toBe('job-1')
    expect(data.status).toBe('pending')
  })

  it('rejects with 409 when active job exists', async () => {
    mockStorage.getActiveJob.mockResolvedValue({ id: 'existing', status: 'processing' })
    const res = await callPost()
    expect(res.status).toBe(409)
  })
})

describe('DELETE /api/repos/[id]/index', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cancels active job directly (no Inngest involvement)', async () => {
    mockStorage.getActiveJob.mockResolvedValue({
      id: 'job-1',
      status: 'processing',
      errorLog: [],
    })
    mockStorage.updateJobStatus.mockResolvedValue(undefined)

    const { DELETE } = await import('./route')
    const req = new NextRequest('http://localhost/api/repos/repo-1/index', {
      method: 'DELETE',
    })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'repo-1' }) })
    expect(res.status).toBe(200)
    expect(mockSend).not.toHaveBeenCalled()
    expect(mockStorage.updateJobStatus).toHaveBeenCalledWith(
      'job-1',
      'failed',
      expect.objectContaining({
        errorLog: expect.arrayContaining([
          expect.objectContaining({ error: 'Cancelled by user' }),
        ]),
      }),
    )
  })
})
