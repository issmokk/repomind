// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { startIndexingJob, processNextBatch, checkAndMarkStaleJob, PipelineError } from './pipeline'
import type { Repository } from '@/types/repository'
import type { IndexingJob, FileToProcess } from '@/types/indexing'

vi.mock('./parser', () => ({
  initTreeSitter: vi.fn(async () => {}),
  getLanguage: vi.fn(async () => ({ query: vi.fn(() => ({ captures: vi.fn(() => []) })) })),
  parseCode: vi.fn(() => ({ rootNode: { type: 'program', text: '', startPosition: { row: 0, column: 0 }, endPosition: { row: 10, column: 0 }, parent: null, children: [], childCount: 0 } })),
}))

vi.mock('./ast-analyzer', () => ({
  detectLanguage: vi.fn(() => 'typescript'),
  extractSymbols: vi.fn(async () => []),
  extractImports: vi.fn(async () => []),
  extractCallSites: vi.fn(async () => []),
  extractInheritance: vi.fn(async () => []),
}))

vi.mock('./chunker', () => ({
  chunkFile: vi.fn(async () => [{
    content: 'code', contextualizedContent: 'ctx\n---\ncode',
    language: 'typescript', symbolName: null, symbolType: null,
    startLine: 1, endLine: 5, parentScope: null, chunkIndex: 0,
  }]),
}))

vi.mock('./graph-builder', () => ({ buildGraphEdges: vi.fn(() => []) }))
vi.mock('./file-filter', () => ({ shouldIndexFile: vi.fn(() => ({ index: true })) }))

const fn = vi.fn

function mockStorage(overrides: Record<string, unknown> = {}) {
  const files: FileToProcess[] = [
    { path: 'src/a.ts', sha: 'sha1', status: 'added' },
    { path: 'src/b.ts', sha: 'sha2', status: 'added' },
    { path: 'src/c.ts', sha: 'sha3', status: 'added' },
  ]
  const filesEntry = { error: '__files__', file: JSON.stringify(files), timestamp: '' }

  return {
    getActiveJob: fn(async () => null),
    createJob: fn(async (data: Record<string, unknown>) => ({
      id: 'job-1', repoId: data.repoId, status: 'pending', triggerType: data.triggerType,
      fromCommit: null, toCommit: 'main', totalFiles: 0, processedFiles: 0,
      failedFiles: 0, currentFile: null, errorLog: [filesEntry],
      lastHeartbeatAt: new Date().toISOString(), startedAt: new Date().toISOString(), completedAt: null,
    })),
    updateJobStatus: fn(async () => {}),
    updateJobProgress: fn(async () => {}),
    updateRepository: fn(async () => ({})),
    getRepository: fn(async () => REPO),
    bulkInvalidateCache: fn(async () => {}),
    upsertChunks: fn(async () => {}),
    upsertEdges: fn(async () => {}),
    deleteChunksByFile: fn(async () => {}),
    deleteEdgesByFile: fn(async () => {}),
    markJobStale: fn(async () => {}),
    ...overrides,
  } as never
}

function mockGitHub() {
  return {
    getRepoMetadata: fn(async () => ({ name: 'repo', fullName: 'owner/repo', defaultBranch: 'main', url: '', private: false })),
    getFileTree: fn(async () => [
      { path: 'src/a.ts', sha: 'sha1', size: 100, type: 'blob' },
      { path: 'src/b.ts', sha: 'sha2', size: 200, type: 'blob' },
    ]),
    compareCommits: fn(async () => [{ filename: 'src/changed.ts', status: 'modified', sha: 'sha3' }]),
  } as never
}

function mockCache() {
  return {
    fetchOrCacheFile: fn(async () => ({ content: 'export const x = 1', sha: 'abc', size: 20, encoding: 'utf-8' })),
    clearCacheForRepo: fn(async () => {}),
  } as never
}

function mockEmbed() {
  return {
    name: 'mock', dimensions: 1536,
    validateDimensions: fn(async () => {}),
    embed: fn(async (texts: string[]) => texts.map(() => Array(1536).fill(0))),
    embedSingle: fn(async () => Array(1536).fill(0)),
  } as never
}

const REPO: Repository = {
  id: 'repo-1', orgId: 'org-1', name: 'repo', fullName: 'owner/repo',
  url: 'https://github.com/owner/repo', defaultBranch: 'main',
  lastIndexedCommit: null, githubAuthType: 'pat',
  createdAt: '2026-01-01', updatedAt: '2026-01-01',
}

describe('startIndexingJob', () => {
  it('creates job and begins processing', async () => {
    const storage = mockStorage()
    await startIndexingJob(REPO, storage, mockGitHub(), mockCache(), mockEmbed())
    expect((storage as Record<string, ReturnType<typeof fn>>).createJob).toHaveBeenCalled()
    expect((storage as Record<string, ReturnType<typeof fn>>).updateJobStatus).toHaveBeenCalled()
  })

  it('throws 409 when active job exists', async () => {
    const storage = mockStorage({ getActiveJob: fn(async () => ({ id: 'existing', status: 'processing' })) })
    await expect(startIndexingJob(REPO, storage, mockGitHub(), mockCache(), mockEmbed())).rejects.toThrow(PipelineError)
  })

  it('evicts cache on full re-index', async () => {
    const storage = mockStorage()
    await startIndexingJob(REPO, storage, mockGitHub(), mockCache(), mockEmbed())
    expect((storage as Record<string, ReturnType<typeof fn>>).bulkInvalidateCache).toHaveBeenCalledWith('repo-1')
  })

  it('uses compareCommits for incremental index', async () => {
    const repoWithCommit = { ...REPO, lastIndexedCommit: 'prev-sha' }
    const gh = mockGitHub()
    const storage = mockStorage()
    await startIndexingJob(repoWithCommit, storage, gh, mockCache(), mockEmbed())
    expect((gh as Record<string, ReturnType<typeof fn>>).compareCommits).toHaveBeenCalled()
    expect((storage as Record<string, ReturnType<typeof fn>>).bulkInvalidateCache).not.toHaveBeenCalled()
  })

  it('marks job failed if embedding validation fails', async () => {
    const storage = mockStorage()
    const embed = mockEmbed()
    ;(embed as Record<string, ReturnType<typeof fn>>).validateDimensions.mockRejectedValue(new Error('dim mismatch'))
    const result = await startIndexingJob(REPO, storage, mockGitHub(), mockCache(), embed)
    expect(result.status).toBe('failed')
  })
})

describe('processNextBatch', () => {
  const files: FileToProcess[] = [
    { path: 'src/a.ts', sha: 'sha1', status: 'added' },
    { path: 'src/b.ts', sha: 'sha2', status: 'added' },
    { path: 'src/c.ts', sha: 'sha3', status: 'added' },
  ]
  const filesEntry = { error: '__files__', file: JSON.stringify(files), timestamp: '' }

  const activeJob: IndexingJob = {
    id: 'job-1', repoId: 'repo-1', status: 'processing', triggerType: 'manual',
    fromCommit: null, toCommit: 'main', totalFiles: 3, processedFiles: 0,
    failedFiles: 0, currentFile: null, errorLog: [filesEntry],
    lastHeartbeatAt: new Date().toISOString(), startedAt: new Date().toISOString(), completedAt: null,
  }

  it('processes batch and reports progress', async () => {
    const storage = mockStorage({ getActiveJob: fn(async () => activeJob) })
    const result = await processNextBatch('job-1', 'repo-1', storage, mockGitHub(), mockCache(), mockEmbed(), { batchSize: 2 })
    expect(result.job.processedFiles).toBe(2)
    expect(result.hasMore).toBe(true)
  })

  it('completes job when all files done', async () => {
    const storage = mockStorage({ getActiveJob: fn(async () => activeJob) })
    const result = await processNextBatch('job-1', 'repo-1', storage, mockGitHub(), mockCache(), mockEmbed(), { batchSize: 5 })
    expect(result.job.status).toBe('completed')
    expect(result.hasMore).toBe(false)
  })

  it('updates heartbeat via updateJobProgress', async () => {
    const storage = mockStorage({ getActiveJob: fn(async () => activeJob) })
    await processNextBatch('job-1', 'repo-1', storage, mockGitHub(), mockCache(), mockEmbed())
    expect((storage as Record<string, ReturnType<typeof fn>>).updateJobProgress).toHaveBeenCalled()
  })

  it('handles file failure and continues', async () => {
    const cache = mockCache()
    ;(cache as Record<string, ReturnType<typeof fn>>).fetchOrCacheFile
      .mockResolvedValueOnce({ content: 'ok', sha: 'a', size: 10, encoding: 'utf-8' })
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce({ content: 'ok', sha: 'c', size: 10, encoding: 'utf-8' })

    const storage = mockStorage({ getActiveJob: fn(async () => activeJob) })
    const result = await processNextBatch('job-1', 'repo-1', storage, mockGitHub(), cache, mockEmbed(), { batchSize: 5 })
    expect(result.job.failedFiles).toBe(1)
    expect(result.job.processedFiles).toBe(2)
    expect(result.job.status).toBe('partial')
  })

  it('detects stale job', async () => {
    const staleJob = { ...activeJob, lastHeartbeatAt: new Date(Date.now() - 6 * 60 * 1000).toISOString() }
    const storage = mockStorage({ getActiveJob: fn(async () => staleJob) })
    const result = await processNextBatch('job-1', 'repo-1', storage, mockGitHub(), mockCache(), mockEmbed())
    expect(result.job.status).toBe('failed')
  })

  it('handles deleted files', async () => {
    const delFiles: FileToProcess[] = [{ path: 'src/old.ts', sha: '', status: 'removed' }]
    const delEntry = { error: '__files__', file: JSON.stringify(delFiles), timestamp: '' }
    const job = { ...activeJob, totalFiles: 1, errorLog: [delEntry] }
    const storage = mockStorage({ getActiveJob: fn(async () => job) })
    await processNextBatch('job-1', 'repo-1', storage, mockGitHub(), mockCache(), mockEmbed())
    expect((storage as Record<string, ReturnType<typeof fn>>).deleteChunksByFile).toHaveBeenCalledWith('repo-1', 'src/old.ts')
    expect((storage as Record<string, ReturnType<typeof fn>>).deleteEdgesByFile).toHaveBeenCalledWith('repo-1', 'src/old.ts')
  })

  it('handles renamed files', async () => {
    const renameFiles: FileToProcess[] = [{ path: 'src/new.ts', sha: 'sha1', status: 'renamed', previousPath: 'src/old.ts' }]
    const renameEntry = { error: '__files__', file: JSON.stringify(renameFiles), timestamp: '' }
    const job = { ...activeJob, totalFiles: 1, errorLog: [renameEntry] }
    const storage = mockStorage({ getActiveJob: fn(async () => job) })
    await processNextBatch('job-1', 'repo-1', storage, mockGitHub(), mockCache(), mockEmbed())
    expect((storage as Record<string, ReturnType<typeof fn>>).deleteChunksByFile).toHaveBeenCalledWith('repo-1', 'src/old.ts')
  })

  it('handles modified files by deleting first', async () => {
    const modFiles: FileToProcess[] = [{ path: 'src/mod.ts', sha: 'sha1', status: 'modified' }]
    const modEntry = { error: '__files__', file: JSON.stringify(modFiles), timestamp: '' }
    const job = { ...activeJob, totalFiles: 1, errorLog: [modEntry] }
    const storage = mockStorage({ getActiveJob: fn(async () => job) })
    await processNextBatch('job-1', 'repo-1', storage, mockGitHub(), mockCache(), mockEmbed())
    expect((storage as Record<string, ReturnType<typeof fn>>).deleteChunksByFile).toHaveBeenCalledWith('repo-1', 'src/mod.ts')
    expect((storage as Record<string, ReturnType<typeof fn>>).deleteEdgesByFile).toHaveBeenCalledWith('repo-1', 'src/mod.ts')
  })
})

describe('checkAndMarkStaleJob', () => {
  it('returns null when no active job', async () => {
    expect(await checkAndMarkStaleJob('repo-1', mockStorage())).toBeNull()
  })

  it('marks stale job as failed', async () => {
    const stale = { id: 'j1', status: 'processing', lastHeartbeatAt: new Date(Date.now() - 6 * 60 * 1000).toISOString() }
    const storage = mockStorage({ getActiveJob: fn(async () => stale) })
    const result = await checkAndMarkStaleJob('repo-1', storage)
    expect(result!.status).toBe('failed')
  })

  it('returns active job if not stale', async () => {
    const fresh = { id: 'j1', status: 'processing', lastHeartbeatAt: new Date().toISOString() }
    const storage = mockStorage({ getActiveJob: fn(async () => fresh) })
    const result = await checkAndMarkStaleJob('repo-1', storage)
    expect(result!.status).toBe('processing')
  })
})
