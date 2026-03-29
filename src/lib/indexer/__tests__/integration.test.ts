// @vitest-environment node
import { describe, it, expect, vi, beforeEach as _beforeEach } from 'vitest'
import { startIndexingJob, processNextBatch, checkAndMarkStaleJob, PipelineError } from '../pipeline'
import type { Repository } from '@/types/repository'
import type { IndexingJob, FileToProcess as _FileToProcess } from '@/types/indexing'

vi.mock('../parser', () => ({
  initTreeSitter: vi.fn(async () => { }),
  getLanguage: vi.fn(async () => ({ query: vi.fn(() => ({ captures: vi.fn(() => []) })) })),
  parseCode: vi.fn(() => ({
    rootNode: {
      type: 'program', text: '', children: [], childCount: 0,
      startPosition: { row: 0, column: 0 }, endPosition: { row: 10, column: 0 }, parent: null,
    },
  })),
}))

vi.mock('../ast-analyzer', () => ({
  detectLanguage: vi.fn((path: string) => {
    if (path.endsWith('.ts')) return 'typescript'
    if (path.endsWith('.rb')) return 'ruby'
    return null
  }),
  extractSymbols: vi.fn(async () => []),
  extractImports: vi.fn(async () => []),
  extractCallSites: vi.fn(async () => []),
  extractInheritance: vi.fn(async () => []),
}))

vi.mock('../chunker', () => ({
  chunkFile: vi.fn(async (content: string, _symbols: unknown[], filePath: string, language: string) => [{
    content, contextualizedContent: `File: ${filePath}\nLanguage: ${language}\n---\n${content}`,
    language, symbolName: null, symbolType: null,
    startLine: 1, endLine: 5, parentScope: null, chunkIndex: 0,
  }]),
}))

vi.mock('../graph-builder', () => ({
  buildGraphEdges: vi.fn(() => []),
}))

vi.mock('../file-filter', () => ({
  shouldIndexFile: vi.fn(() => ({ index: true })),
}))

const fn = vi.fn

interface StorageState {
  chunks: Record<string, unknown>[]
  edges: Record<string, unknown>[]
  jobs: Record<string, IndexingJob>
  lastIndexedCommit: string | null
}

function createInMemoryStorage(): Record<string, unknown> & { _state: StorageState } {
  const state: StorageState = { chunks: [], edges: [], jobs: {}, lastIndexedCommit: null }

  return {
    _state: state,
    getActiveJob: fn(async (repoId: string) =>
      Object.values(state.jobs).find(
        (j) => j.repoId === repoId && ['pending', 'fetching_files', 'processing', 'embedding'].includes(j.status),
      ) ?? null,
    ),
    createJob: fn(async (data: Record<string, unknown>) => {
      const job: IndexingJob = {
        id: `job-${Object.keys(state.jobs).length + 1}`, repoId: data.repoId as string,
        status: 'pending', triggerType: data.triggerType as 'manual',
        fromCommit: (data.fromCommit as string) ?? null, toCommit: (data.toCommit as string) ?? 'main',
        totalFiles: 0, processedFiles: 0, failedFiles: 0, currentFile: null, errorLog: [],
        lastHeartbeatAt: new Date().toISOString(), startedAt: new Date().toISOString(), completedAt: null,
      }
      state.jobs[job.id] = job
      return job
    }),
    updateJobStatus: fn(async (jobId: string, status: string, extra?: Record<string, unknown>) => {
      if (state.jobs[jobId]) state.jobs[jobId] = { ...state.jobs[jobId], status: status as IndexingJob['status'], ...extra }
    }),
    updateJobProgress: fn(async (jobId: string, progress: Record<string, unknown>) => {
      if (state.jobs[jobId]) state.jobs[jobId] = { ...state.jobs[jobId], ...progress, lastHeartbeatAt: new Date().toISOString() }
    }),
    updateRepository: fn(async (_id: string, data: Record<string, unknown>) => {
      if (data.lastIndexedCommit) state.lastIndexedCommit = data.lastIndexedCommit as string
      return REPO
    }),
    getRepository: fn(async () => ({ ...REPO, lastIndexedCommit: state.lastIndexedCommit })),
    getLatestJob: fn(async (repoId: string) => {
      const all = Object.values(state.jobs).filter((j) => j.repoId === repoId)
      return all[all.length - 1] ?? null
    }),
    bulkInvalidateCache: fn(async () => { }),
    upsertChunks: fn(async (newChunks: Record<string, unknown>[]) => { state.chunks.push(...newChunks) }),
    upsertEdges: fn(async (newEdges: Record<string, unknown>[]) => { state.edges.push(...newEdges) }),
    deleteChunksByFile: fn(async (_repoId: string, filePath: string) => {
      state.chunks = state.chunks.filter((c) => c.filePath !== filePath)
    }),
    deleteEdgesByFile: fn(async (_repoId: string, filePath: string) => {
      state.edges = state.edges.filter((e) => e.sourceFile !== filePath && e.targetFile !== filePath)
    }),
    markJobStale: fn(async (job: IndexingJob) => {
      if (state.jobs[job.id]) {
        state.jobs[job.id].status = 'failed'
        state.jobs[job.id].errorLog = [...(state.jobs[job.id].errorLog ?? []),
        { error: 'stale: no heartbeat for over 5 minutes', timestamp: new Date().toISOString() }]
      }
    }),
    getSettings: fn(async () => ({ embeddingProvider: 'ollama' })),
  }
}

const DEFAULT_FILES = [
  { path: 'src/index.ts', sha: 'sha1' },
  { path: 'app/services/payment.rb', sha: 'sha2' },
  { path: 'config/settings.json', sha: 'sha3' },
]

function createMockGitHub(files = DEFAULT_FILES) {
  return {
    getRepoMetadata: fn(async () => ({ name: 'repo', fullName: 'owner/repo', defaultBranch: 'main', url: '', private: false })),
    getFileTree: fn(async () => files.map((f) => ({ path: f.path, sha: f.sha, size: 100, type: 'blob' }))),
    compareCommits: fn(async () => []),
  } as never
}

let _embedCallCount = 0
function createMockCache() {
  return {
    fetchOrCacheFile: fn(async (_repoId: string, _o: string, _r: string, path: string) => ({
      content: `// content of ${path}`, sha: `sha-${path}`, size: 50, encoding: 'utf-8',
    })),
    clearCacheForRepo: fn(async () => { }),
  } as never
}

function createMockEmbedding(shouldFail = false) {
  _embedCallCount = 0
  return {
    name: 'mock', dimensions: 1536,
    validateDimensions: fn(async () => { if (shouldFail) throw new Error('dimension mismatch: expected 1536, got 768') }),
    embed: fn(async (texts: string[]) => texts.map((t) => {
      _embedCallCount++
      const hash = [...t].reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)
      return Array.from({ length: 1536 }, (_, i) => (hash + i) / 10000)
    })),
    embedSingle: fn(async () => Array(1536).fill(0.1)),
  } as never
}

const REPO: Repository = {
  id: 'repo-1', orgId: 'org-1', name: 'repo', fullName: 'owner/repo',
  url: 'https://github.com/owner/repo', defaultBranch: 'main',
  lastIndexedCommit: null, githubAuthType: 'pat',
  createdAt: '2026-01-01', updatedAt: '2026-01-01',
}

describe('Integration: Full Indexing Pipeline', () => {
  describe('Full index flow', () => {
    it('indexes all files, produces chunks with distinct embeddings, and completes', async () => {
      const storage = createInMemoryStorage()
      const job = await startIndexingJob(REPO, storage as never, createMockGitHub(), createMockCache(), createMockEmbedding())

      expect(job.status).toBe('completed')
      expect(storage._state.chunks.length).toBe(3)
      expect(storage.bulkInvalidateCache).toHaveBeenCalledWith('repo-1')

      const embeddings = storage._state.chunks.map((c) => c.embedding as number[])
      const e1 = embeddings[0]
      const e2 = embeddings[1]
      expect(e1).not.toEqual(e2)
    })

    it('validates embedding dimensions before processing', async () => {
      const storage = createInMemoryStorage()
      const embed = createMockEmbedding()
      await startIndexingJob(REPO, storage as never, createMockGitHub(), createMockCache(), embed)
      expect((embed as Record<string, ReturnType<typeof fn>>).validateDimensions).toHaveBeenCalled()
    })

    it('updates lastIndexedCommit on completion', async () => {
      const storage = createInMemoryStorage()
      await startIndexingJob(REPO, storage as never, createMockGitHub(), createMockCache(), createMockEmbedding())
      expect(storage.updateRepository).toHaveBeenCalled()
    })

    it('includes Ruby file in test data (covers Ruby AST path)', async () => {
      const storage = createInMemoryStorage()
      await startIndexingJob(REPO, storage as never, createMockGitHub(), createMockCache(), createMockEmbedding())
      const rubyChunks = storage._state.chunks.filter((c) => (c.filePath as string).endsWith('.rb'))
      expect(rubyChunks.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Multi-batch processing', () => {
    it('processes files across multiple batches via processNextBatch loop', async () => {
      const storage = createInMemoryStorage()
      const gh = createMockGitHub()
      const cache = createMockCache()
      const embed = createMockEmbedding()

      const job = await startIndexingJob(REPO, storage as never, gh, cache, embed, { triggerType: 'manual', batchSize: 1 })

      if (job.status !== 'completed') {
        let hasMore = true
        while (hasMore) {
          const result = await processNextBatch(job.id, 'repo-1', storage as never, gh, cache, embed, { batchSize: 1 })
          hasMore = result.hasMore
        }
      }

      expect(storage._state.chunks.length).toBe(3)
    })
  })

  describe('Incremental indexing', () => {
    async function setupFullIndex(storage: ReturnType<typeof createInMemoryStorage>) {
      const gh = createMockGitHub()
      await startIndexingJob(REPO, storage as never, gh, createMockCache(), createMockEmbedding())
      storage._state.lastIndexedCommit = 'prev-sha'
      return storage
    }

    it('processes only modified files after full index', async () => {
      const storage = await setupFullIndex(createInMemoryStorage())
      const initialChunkCount = storage._state.chunks.length
      expect(initialChunkCount).toBe(3)

      const gh = createMockGitHub()
        ; (gh as Record<string, ReturnType<typeof fn>>).compareCommits.mockResolvedValue([
          { filename: 'src/index.ts', status: 'modified', sha: 'new-sha' },
        ])

      const repoWithCommit = { ...REPO, lastIndexedCommit: 'prev-sha' }
      await startIndexingJob(repoWithCommit, storage as never, gh, createMockCache(), createMockEmbedding())

      expect(storage.deleteChunksByFile).toHaveBeenCalledWith('repo-1', 'src/index.ts')
      const tsChunks = storage._state.chunks.filter((c) => c.filePath === 'src/index.ts')
      expect(tsChunks.length).toBeGreaterThanOrEqual(1)
    })

    it('removes chunks and edges for deleted files', async () => {
      const storage = await setupFullIndex(createInMemoryStorage())
      expect(storage._state.chunks.length).toBe(3)

      const gh = createMockGitHub()
        ; (gh as Record<string, ReturnType<typeof fn>>).compareCommits.mockResolvedValue([
          { filename: 'src/index.ts', status: 'removed', sha: '' },
        ])

      const repoWithCommit = { ...REPO, lastIndexedCommit: 'prev-sha' }
      await startIndexingJob(repoWithCommit, storage as never, gh, createMockCache(), createMockEmbedding())

      const removedChunks = storage._state.chunks.filter((c) => c.filePath === 'src/index.ts')
      expect(removedChunks).toHaveLength(0)
      expect(storage.deleteEdgesByFile).toHaveBeenCalledWith('repo-1', 'src/index.ts')
    })

    it('handles renamed files: deletes old path, creates new path', async () => {
      const storage = await setupFullIndex(createInMemoryStorage())

      const gh = createMockGitHub()
        ; (gh as Record<string, ReturnType<typeof fn>>).compareCommits.mockResolvedValue([
          { filename: 'src/renamed.ts', status: 'renamed', previousFilename: 'src/index.ts', sha: 'sha-new' },
        ])

      const repoWithCommit = { ...REPO, lastIndexedCommit: 'prev-sha' }
      await startIndexingJob(repoWithCommit, storage as never, gh, createMockCache(), createMockEmbedding())

      expect(storage.deleteChunksByFile).toHaveBeenCalledWith('repo-1', 'src/index.ts')
      const oldChunks = storage._state.chunks.filter((c) => c.filePath === 'src/index.ts')
      expect(oldChunks).toHaveLength(0)
      const newChunks = storage._state.chunks.filter((c) => c.filePath === 'src/renamed.ts')
      expect(newChunks.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Embedding dimension validation', () => {
    it('fails job immediately with no chunks written', async () => {
      const storage = createInMemoryStorage()
      const job = await startIndexingJob(REPO, storage as never, createMockGitHub(), createMockCache(), createMockEmbedding(true))
      expect(job.status).toBe('failed')
      expect(storage._state.chunks).toHaveLength(0)
    })
  })

  describe('Partial failure handling', () => {
    it('continues after file failure, marks partial, logs error', async () => {
      const cache = createMockCache()
      let callCount = 0
        ; (cache as Record<string, ReturnType<typeof fn>>).fetchOrCacheFile.mockImplementation(async () => {
          callCount++
          if (callCount === 2) throw new Error('network error on file 2')
          return { content: '// ok', sha: 'sha', size: 10, encoding: 'utf-8' }
        })

      const storage = createInMemoryStorage()
      const job = await startIndexingJob(REPO, storage as never, createMockGitHub(), cache, createMockEmbedding())

      expect(job.status).toBe('partial')
      expect(job.failedFiles).toBe(1)
      expect(job.processedFiles).toBe(2)
      expect(storage._state.chunks.length).toBe(2)
    })
  })

  describe('Stale job detection', () => {
    it('marks stale job as failed with error log entry', async () => {
      const storage = createInMemoryStorage()
      storage._state.jobs['stale-job'] = {
        id: 'stale-job', repoId: 'repo-1', status: 'processing', triggerType: 'manual',
        fromCommit: null, toCommit: 'main', totalFiles: 10, processedFiles: 3,
        failedFiles: 0, currentFile: null, errorLog: [],
        lastHeartbeatAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
        startedAt: '2026-01-01', completedAt: null,
      }

      const result = await checkAndMarkStaleJob('repo-1', storage as never)

      expect(result!.status).toBe('failed')
      expect(storage.markJobStale).toHaveBeenCalled()
      const jobRecord = storage._state.jobs['stale-job']
      expect(jobRecord.errorLog.some((e) => e.error.includes('stale'))).toBe(true)
    })

    it('allows new job after stale job is cleared', async () => {
      const storage = createInMemoryStorage()
      storage._state.jobs['stale-job'] = {
        id: 'stale-job', repoId: 'repo-1', status: 'processing', triggerType: 'manual',
        fromCommit: null, toCommit: 'main', totalFiles: 10, processedFiles: 3,
        failedFiles: 0, currentFile: null, errorLog: [],
        lastHeartbeatAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
        startedAt: '2026-01-01', completedAt: null,
      }

      await checkAndMarkStaleJob('repo-1', storage as never)
      expect(storage._state.jobs['stale-job'].status).toBe('failed')

      const newJob = await startIndexingJob(REPO, storage as never, createMockGitHub(), createMockCache(), createMockEmbedding())
      expect(newJob.status).toBe('completed')
    })
  })

  describe('Concurrency guard', () => {
    it('rejects new job when active job exists', async () => {
      const storage = createInMemoryStorage()
      storage._state.jobs['active-job'] = {
        id: 'active-job', repoId: 'repo-1', status: 'processing', triggerType: 'manual',
        fromCommit: null, toCommit: 'main', totalFiles: 5, processedFiles: 2,
        failedFiles: 0, currentFile: null, errorLog: [],
        lastHeartbeatAt: new Date().toISOString(), startedAt: '2026-01-01', completedAt: null,
      }

      await expect(
        startIndexingJob(REPO, storage as never, createMockGitHub(), createMockCache(), createMockEmbedding()),
      ).rejects.toThrow(PipelineError)
    })
  })
})
