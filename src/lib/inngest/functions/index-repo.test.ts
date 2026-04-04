// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { indexRepoFunction } from './index-repo'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({})),
}))

const mockStorage = {
  getActiveJob: vi.fn(),
  getRepository: vi.fn(),
  createJob: vi.fn(),
  updateJobStatus: vi.fn(),
  updateJobProgress: vi.fn(),
  bulkInvalidateCache: vi.fn(),
  getSettings: vi.fn(),
  getTeamSettingsDecrypted: vi.fn(),
  updateRepository: vi.fn(),
}

vi.mock('@/lib/storage/supabase', () => ({
  SupabaseStorageProvider: class { constructor() { return mockStorage } },
}))

const mockGhClient = {
  getRepoMetadata: vi.fn(),
  getFileTree: vi.fn(),
  compareCommits: vi.fn(),
}

vi.mock('@/lib/github', () => ({
  GitHubClient: class { constructor() { return mockGhClient } },
  PersonalAccessTokenAuth: class {},
  GitHubFileCache: class {},
}))

vi.mock('@/lib/indexer/embedding', () => ({
  createEmbeddingProvider: vi.fn(() => ({
    embed: vi.fn(() => []),
    validateDimensions: vi.fn(),
    name: 'test',
  })),
}))

vi.mock('@/lib/indexer/pipeline', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/indexer/pipeline')>()
  return {
    ...original,
    processBatchOfFiles: vi.fn(() => ({ processed: 2, failed: 0, errors: [] })),
  }
})

vi.mock('@/lib/indexer/file-filter', () => ({
  shouldIndexFile: vi.fn(() => ({ index: true, reason: 'ok' })),
}))

describe('index-repo Inngest function', () => {
  const stepResults = new Map<string, unknown>()
  const mockStep = {
    run: vi.fn(async (name: string, fn: () => Promise<unknown>) => {
      const result = await fn()
      stepResults.set(name, result)
      return result
    }),
  }

  const baseRepo = {
    id: 'repo-1',
    fullName: 'owner/repo',
    defaultBranch: 'main',
    lastIndexedCommit: null,
    orgId: 'org-1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    stepResults.clear()

    mockStorage.getActiveJob.mockResolvedValue(null)
    mockStorage.getRepository.mockResolvedValue(baseRepo)
    mockStorage.createJob.mockResolvedValue({ id: 'job-1', status: 'pending' })
    mockStorage.updateJobStatus.mockResolvedValue(undefined)
    mockStorage.updateJobProgress.mockResolvedValue(undefined)
    mockStorage.bulkInvalidateCache.mockResolvedValue(undefined)
    mockStorage.getSettings.mockResolvedValue({ embeddingProvider: 'ollama' })
    mockStorage.getTeamSettingsDecrypted.mockResolvedValue({
      ollamaModel: 'nomic-embed-text',
      ollamaBaseUrl: 'http://localhost:11434',
    })
    mockStorage.updateRepository.mockResolvedValue(undefined)

    mockGhClient.getRepoMetadata.mockResolvedValue({ defaultBranch: 'main' })
    mockGhClient.getFileTree.mockResolvedValue([
      { path: 'src/index.ts', sha: 'abc', size: 100 },
      { path: 'src/app.ts', sha: 'def', size: 200 },
    ])
  })

  function runFunction(overrides: Record<string, unknown> = {}) {
    const event = {
      data: {
        repoId: 'repo-1',
        jobId: 'job-1',
        triggerType: 'manual',
        ...overrides,
      },
    }
    // Access the internal handler via the function config
    // Inngest functions expose their handler; we call it directly for testing
    return (indexRepoFunction as never as { fn: (ctx: { event: typeof event; step: typeof mockStep }) => Promise<unknown> }).fn({
      event,
      step: mockStep,
    })
  }

  describe('Step 1: Initialize', () => {
    it('uses jobId from event data (no job creation in Inngest function)', async () => {
      await runFunction()
      expect(mockStorage.createJob).not.toHaveBeenCalled()
      expect(mockStorage.updateJobStatus).toHaveBeenCalledWith('job-1', 'fetching_files')
    })

    it('fetches file list via full scan when no lastIndexedCommit exists', async () => {
      await runFunction()
      expect(mockGhClient.getFileTree).toHaveBeenCalledWith('owner', 'repo', 'main')
      expect(mockGhClient.compareCommits).not.toHaveBeenCalled()
    })

    it('fetches file list via git diff when lastIndexedCommit exists and trigger is webhook', async () => {
      mockStorage.getRepository.mockResolvedValue({
        ...baseRepo,
        lastIndexedCommit: 'abc123',
      })
      mockGhClient.compareCommits.mockResolvedValue([
        { filename: 'src/changed.ts', sha: 'xyz', status: 'modified' },
      ])

      await runFunction({ triggerType: 'webhook' })
      expect(mockGhClient.compareCommits).toHaveBeenCalledWith('owner', 'repo', 'abc123', 'main')
    })

    it('does full scan on manual trigger even when lastIndexedCommit exists', async () => {
      mockStorage.getRepository.mockResolvedValue({
        ...baseRepo,
        lastIndexedCommit: 'abc123',
      })

      await runFunction({ triggerType: 'manual' })
      expect(mockGhClient.getFileTree).toHaveBeenCalled()
      expect(mockGhClient.compareCommits).not.toHaveBeenCalled()
    })

    it('returns file list via step state (not via errorLog)', async () => {
      await runFunction()
      const initResult = stepResults.get('initialize') as Record<string, unknown>
      expect(initResult.filesToProcess).toBeDefined()
      expect(Array.isArray(initResult.filesToProcess)).toBe(true)
      // errorLog should be empty, not containing __files__
      expect(mockStorage.updateJobStatus).toHaveBeenCalledWith(
        'job-1',
        'processing',
        expect.objectContaining({ errorLog: [] }),
      )
    })

    // Active job check is now in the API route, not in the Inngest function
  })

  describe('Batch processing steps', () => {
    it('processes files in batches', async () => {
      const { processBatchOfFiles } = await import('@/lib/indexer/pipeline')
      await runFunction()
      expect(processBatchOfFiles).toHaveBeenCalled()
    })

    it('updates job progress after each batch', async () => {
      await runFunction()
      expect(mockStorage.updateJobProgress).toHaveBeenCalled()
    })

    it('uses adaptive batch sizing: 5 for <= 200 files', async () => {
      const { getAdaptiveBatchSize } = await import('@/lib/indexer/pipeline')
      expect(getAdaptiveBatchSize(50)).toBe(5)
      expect(getAdaptiveBatchSize(200)).toBe(5)
      expect(getAdaptiveBatchSize(500)).toBe(10)
      expect(getAdaptiveBatchSize(1001)).toBe(15)
    })
  })

  describe('Finalize step', () => {
    it('marks job as completed when all files succeed', async () => {
      await runFunction()
      expect(mockStorage.updateJobStatus).toHaveBeenCalledWith(
        'job-1',
        'completed',
        expect.objectContaining({
          completedAt: expect.any(String),
        }),
      )
    })

    it('marks job as partial when some files failed', async () => {
      const { processBatchOfFiles } = await import('@/lib/indexer/pipeline')
      vi.mocked(processBatchOfFiles).mockResolvedValueOnce({
        processed: 1,
        failed: 1,
        errors: [{ error: 'parse error', file: 'bad.ts', timestamp: new Date().toISOString() }],
      })

      await runFunction()
      expect(mockStorage.updateJobStatus).toHaveBeenCalledWith(
        'job-1',
        'partial',
        expect.objectContaining({
          completedAt: expect.any(String),
        }),
      )
    })

    it('updates repository.last_indexed_commit to HEAD commit SHA', async () => {
      await runFunction()
      expect(mockStorage.updateRepository).toHaveBeenCalledWith('repo-1', {
        lastIndexedCommit: 'abc',
      })
    })
  })

  describe('Error handling', () => {
    it('throws on unrecoverable error (repo not found)', async () => {
      mockStorage.getRepository.mockResolvedValue(null)
      await expect(runFunction()).rejects.toThrow('Repository not found')
    })
  })
})
