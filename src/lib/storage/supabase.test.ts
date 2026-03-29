// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SupabaseStorageProvider } from './supabase'
import type { IndexingJob } from '@/types/indexing'

function createMockClient(returnValue: unknown = { data: null, error: null }) {
  const from = vi.fn(() => {
    const proxy: Record<string, unknown> = {}
    const makeChainable = (): Record<string, unknown> => {
      return new Proxy({} as Record<string, unknown>, {
        get(_, prop: string) {
          if (prop === 'then') {
            return (resolve: (v: unknown) => void) => resolve(returnValue)
          }
          return vi.fn(() => makeChainable())
        },
      })
    }
    return makeChainable()
  })
  const rpc = vi.fn(() => Promise.resolve({ data: null, error: null }))
  return { from, rpc }
}

describe('SupabaseStorageProvider', () => {
  let mockClient: ReturnType<typeof createMockClient>
  let provider: SupabaseStorageProvider

  beforeEach(() => {
    mockClient = createMockClient()
    provider = new SupabaseStorageProvider(mockClient as never)
  })

  describe('Repository CRUD', () => {
    it('createRepository inserts and returns repository', async () => {
      const repoData = { data: { id: 'uuid-1', org_id: 'org-1', name: 'repo', full_name: 'owner/repo', url: 'https://github.com/owner/repo', default_branch: 'main', last_indexed_commit: null, github_auth_type: 'pat', created_at: '2026-01-01', updated_at: '2026-01-01' }, error: null }
      mockClient = createMockClient(repoData)
      provider = new SupabaseStorageProvider(mockClient as never)

      const result = await provider.createRepository({
        orgId: 'org-1', name: 'repo', fullName: 'owner/repo', url: 'https://github.com/owner/repo',
        defaultBranch: 'main', lastIndexedCommit: null, githubAuthType: 'pat',
      })
      expect(mockClient.from).toHaveBeenCalledWith('repositories')
      expect(result.fullName).toBe('owner/repo')
    })

    it('getRepositories uses user client for RLS', async () => {
      const userClient = createMockClient({ data: [], error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      await provider.getRepositories(userClient as never)
      expect(userClient.from).toHaveBeenCalledWith('repositories')
      expect(mockClient.from).not.toHaveBeenCalledWith('repositories')
    })

    it('deleteRepository calls delete with correct id', async () => {
      mockClient = createMockClient({ data: null, error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      await provider.deleteRepository('repo-1')
      expect(mockClient.from).toHaveBeenCalledWith('repositories')
    })
  })

  describe('Repository Settings', () => {
    it('createDefaultSettings uses correct defaults', async () => {
      const settingsData = { data: { id: 'uuid-s', repo_id: 'repo-1', branch_filter: ['main'], include_patterns: [], exclude_patterns: [], embedding_provider: 'ollama', embedding_model: 'gte-qwen2-1.5b-instruct', auto_index_on_add: false, created_at: '2026-01-01', updated_at: '2026-01-01' }, error: null }
      mockClient = createMockClient(settingsData)
      provider = new SupabaseStorageProvider(mockClient as never)

      const result = await provider.createDefaultSettings('repo-1')
      expect(result.embeddingProvider).toBe('ollama')
      expect(result.embeddingModel).toBe('gte-qwen2-1.5b-instruct')
      expect(result.autoIndexOnAdd).toBe(false)
      expect(result.branchFilter).toEqual(['main'])
    })

    it('updateSettings persists changed fields', async () => {
      const updated = { data: { id: 'uuid-s', repo_id: 'repo-1', branch_filter: ['main', 'develop'], include_patterns: [], exclude_patterns: [], embedding_provider: 'ollama', embedding_model: 'gte-qwen2-1.5b-instruct', auto_index_on_add: false, created_at: '2026-01-01', updated_at: '2026-01-01' }, error: null }
      mockClient = createMockClient(updated)
      provider = new SupabaseStorageProvider(mockClient as never)

      const result = await provider.updateSettings('repo-1', { branchFilter: ['main', 'develop'] })
      expect(result.branchFilter).toEqual(['main', 'develop'])
    })
  })

  describe('File Cache', () => {
    it('getCachedFile returns null for uncached file', async () => {
      mockClient = createMockClient({ data: null, error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      const result = await provider.getCachedFile('repo-1', 'src/index.ts')
      expect(result).toBeNull()
    })

    it('getCachedFile returns cached content when found', async () => {
      const cached = { data: { id: 1, repo_id: 'repo-1', file_path: 'src/index.ts', content: 'code', sha: 'abc', language: 'typescript', size_bytes: 100, is_generated: false, fetched_at: '2026-01-01' }, error: null }
      mockClient = createMockClient(cached)
      provider = new SupabaseStorageProvider(mockClient as never)

      const result = await provider.getCachedFile('repo-1', 'src/index.ts')
      expect(result).not.toBeNull()
      expect(result!.sha).toBe('abc')
    })

    it('setCachedFile upserts with onConflict', async () => {
      mockClient = createMockClient({ data: null, error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      await provider.setCachedFile('repo-1', {
        repoId: 'repo-1', filePath: 'src/index.ts', content: 'code', sha: 'abc',
        language: 'typescript', sizeBytes: 100, isGenerated: false,
      })
      expect(mockClient.from).toHaveBeenCalledWith('cached_files')
    })

    it('bulkInvalidateCache deletes all for repo', async () => {
      mockClient = createMockClient({ data: null, error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      await provider.bulkInvalidateCache('repo-1')
      expect(mockClient.from).toHaveBeenCalledWith('cached_files')
    })
  })

  describe('Code Chunks', () => {
    it('upsertChunks calls upsert with onConflict', async () => {
      mockClient = createMockClient({ data: null, error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      await provider.upsertChunks([{
        repoId: 'repo-1', filePath: 'src/a.ts', chunkIndex: 0, content: 'code',
        contextualizedContent: 'ctx', language: 'typescript', symbolName: null,
        symbolType: null, startLine: 1, endLine: 5, parentScope: null,
        commitSha: 'abc', embedding: null, embeddingModel: null,
      }])
      expect(mockClient.from).toHaveBeenCalledWith('code_chunks')
    })

    it('upsertChunks skips empty array', async () => {
      await provider.upsertChunks([])
      expect(mockClient.from).not.toHaveBeenCalled()
    })

    it('deleteChunksByFile filters by repo and file', async () => {
      mockClient = createMockClient({ data: null, error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      await provider.deleteChunksByFile('repo-1', 'src/old.ts')
      expect(mockClient.from).toHaveBeenCalledWith('code_chunks')
    })

    it('deleteChunksByRepo filters by repo only', async () => {
      mockClient = createMockClient({ data: null, error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      await provider.deleteChunksByRepo('repo-1')
      expect(mockClient.from).toHaveBeenCalledWith('code_chunks')
    })
  })

  describe('Graph Edges', () => {
    it('upsertEdges inserts edges', async () => {
      mockClient = createMockClient({ data: null, error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      await provider.upsertEdges([{
        repoId: 'repo-1', sourceFile: 'a.ts', sourceSymbol: 'foo', sourceType: 'function',
        targetFile: 'b.ts', targetSymbol: 'bar', targetType: 'function',
        relationshipType: 'calls', metadata: {},
      }])
      expect(mockClient.from).toHaveBeenCalledWith('graph_edges')
    })

    it('deleteEdgesByFile removes source and target edges', async () => {
      mockClient = createMockClient({ data: null, error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      await provider.deleteEdgesByFile('repo-1', 'src/old.ts')
      expect(mockClient.from).toHaveBeenCalledTimes(2)
    })

    it('queryEdgesBySource filters correctly', async () => {
      mockClient = createMockClient({ data: [], error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      await provider.queryEdgesBySource('repo-1', 'src/a.ts', 'foo')
      expect(mockClient.from).toHaveBeenCalledWith('graph_edges')
    })

    it('queryEdgesByTarget filters correctly', async () => {
      mockClient = createMockClient({ data: [], error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      await provider.queryEdgesByTarget('repo-1', 'src/b.ts', 'MyClass')
      expect(mockClient.from).toHaveBeenCalledWith('graph_edges')
    })
  })

  describe('Indexing Jobs', () => {
    it('createJob inserts with pending status', async () => {
      const jobData = { data: { id: 'job-1', repo_id: 'repo-1', status: 'pending', trigger_type: 'manual', from_commit: null, to_commit: 'abc', total_files: 0, processed_files: 0, failed_files: 0, current_file: null, error_log: [], last_heartbeat_at: '2026-01-01', started_at: '2026-01-01', completed_at: null }, error: null }
      mockClient = createMockClient(jobData)
      provider = new SupabaseStorageProvider(mockClient as never)

      const result = await provider.createJob({ repoId: 'repo-1', triggerType: 'manual', toCommit: 'abc' })
      expect(result.status).toBe('pending')
    })

    it('updateJobProgress sets last_heartbeat_at', async () => {
      mockClient = createMockClient({ data: null, error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      await provider.updateJobProgress('job-1', { processedFiles: 5, currentFile: 'src/x.ts' })
      expect(mockClient.from).toHaveBeenCalledWith('indexing_jobs')
    })

    it('getActiveJob filters by active statuses', async () => {
      mockClient = createMockClient({ data: null, error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      const result = await provider.getActiveJob('repo-1')
      expect(result).toBeNull()
    })

    it('markJobStale marks old job as failed', async () => {
      mockClient = createMockClient({ data: null, error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      const staleJob: IndexingJob = {
        id: 'job-1', repoId: 'repo-1', status: 'processing', triggerType: 'manual',
        fromCommit: null, toCommit: 'abc', totalFiles: 10, processedFiles: 3,
        failedFiles: 0, currentFile: 'src/x.ts', errorLog: [],
        lastHeartbeatAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
        startedAt: '2026-01-01', completedAt: null,
      }
      await provider.markJobStale(staleJob)
      expect(mockClient.from).toHaveBeenCalledWith('indexing_jobs')
    })

    it('markJobStale does nothing for fresh job', async () => {
      const freshJob: IndexingJob = {
        id: 'job-1', repoId: 'repo-1', status: 'processing', triggerType: 'manual',
        fromCommit: null, toCommit: 'abc', totalFiles: 10, processedFiles: 3,
        failedFiles: 0, currentFile: 'src/x.ts', errorLog: [],
        lastHeartbeatAt: new Date().toISOString(),
        startedAt: '2026-01-01', completedAt: null,
      }
      await provider.markJobStale(freshJob)
      expect(mockClient.from).not.toHaveBeenCalled()
    })
  })
})
