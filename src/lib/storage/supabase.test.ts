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

    it('upsertEdges skips empty array', async () => {
      await provider.upsertEdges([])
      expect(mockClient.from).not.toHaveBeenCalled()
    })

    it('deleteEdgesByFile removes source and target edges', async () => {
      mockClient = createMockClient({ data: null, error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      await provider.deleteEdgesByFile('repo-1', 'src/old.ts')
      expect(mockClient.from).toHaveBeenCalledTimes(2)
    })

    it('deleteEdgesByRepo removes all edges for repo', async () => {
      mockClient = createMockClient({ data: null, error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      await provider.deleteEdgesByRepo('repo-1')
      expect(mockClient.from).toHaveBeenCalledWith('graph_edges')
    })

    it('queryEdgesBySource filters correctly', async () => {
      mockClient = createMockClient({ data: [], error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      await provider.queryEdgesBySource('repo-1', 'src/a.ts', 'foo')
      expect(mockClient.from).toHaveBeenCalledWith('graph_edges')
    })

    it('queryEdgesBySource returns camelCase edges', async () => {
      mockClient = createMockClient({ data: [{ repo_id: 'repo-1', source_file: 'a.ts', source_symbol: 'foo', source_type: 'function', target_file: 'b.ts', target_symbol: 'bar', target_type: 'function', relationship_type: 'calls' }], error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      const edges = await provider.queryEdgesBySource('repo-1', 'a.ts', 'foo')
      expect(edges).toHaveLength(1)
      expect(edges[0].sourceFile).toBe('a.ts')
      expect(edges[0].targetSymbol).toBe('bar')
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

    it('updateJobStatus updates status only', async () => {
      mockClient = createMockClient({ data: null, error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      await provider.updateJobStatus('job-1', 'completed')
      expect(mockClient.from).toHaveBeenCalledWith('indexing_jobs')
    })

    it('updateJobStatus merges extra fields', async () => {
      mockClient = createMockClient({ data: null, error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      await provider.updateJobStatus('job-1', 'failed', { errorLog: [{ error: 'boom', timestamp: '2026-01-01' }] } as Partial<IndexingJob>)
      expect(mockClient.from).toHaveBeenCalledWith('indexing_jobs')
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

    it('getActiveJob returns camelCase job when found', async () => {
      const jobRow = { data: { id: 'job-1', repo_id: 'repo-1', status: 'processing', trigger_type: 'manual', from_commit: null, to_commit: 'abc', total_files: 10, processed_files: 3, failed_files: 0, current_file: 'x.ts', error_log: [], last_heartbeat_at: '2026-01-01', started_at: '2026-01-01', completed_at: null }, error: null }
      mockClient = createMockClient(jobRow)
      provider = new SupabaseStorageProvider(mockClient as never)

      const result = await provider.getActiveJob('repo-1')
      expect(result).not.toBeNull()
      expect(result!.triggerType).toBe('manual')
      expect(result!.processedFiles).toBe(3)
    })

    it('getLatestJob uses userClient for RLS', async () => {
      const userClient = createMockClient({ data: null, error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      const result = await provider.getLatestJob('repo-1', userClient as never)
      expect(result).toBeNull()
      expect(userClient.from).toHaveBeenCalledWith('indexing_jobs')
      expect(mockClient.from).not.toHaveBeenCalled()
    })

    it('getLatestJob returns camelCase job when found', async () => {
      const jobRow = { data: { id: 'job-1', repo_id: 'repo-1', status: 'completed', trigger_type: 'manual', from_commit: null, to_commit: 'abc', total_files: 10, processed_files: 10, failed_files: 0, current_file: null, error_log: [], last_heartbeat_at: '2026-01-01', started_at: '2026-01-01', completed_at: '2026-01-02' }, error: null }
      const userClient = createMockClient(jobRow)
      provider = new SupabaseStorageProvider(mockClient as never)

      const result = await provider.getLatestJob('repo-1', userClient as never)
      expect(result).not.toBeNull()
      expect(result!.completedAt).toBe('2026-01-02')
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

    it('markJobStale does nothing when no heartbeat', async () => {
      const noHeartbeatJob: IndexingJob = {
        id: 'job-1', repoId: 'repo-1', status: 'processing', triggerType: 'manual',
        fromCommit: null, toCommit: 'abc', totalFiles: 10, processedFiles: 0,
        failedFiles: 0, currentFile: null, errorLog: [],
        lastHeartbeatAt: null as unknown as string,
        startedAt: '2026-01-01', completedAt: null,
      }
      await provider.markJobStale(noHeartbeatJob)
      expect(mockClient.from).not.toHaveBeenCalled()
    })
  })

  describe('Repository updates', () => {
    it('updateRepository returns camelCase repo', async () => {
      const updated = { data: { id: 'repo-1', org_id: 'org-1', name: 'repo', full_name: 'owner/repo', url: 'https://github.com/owner/repo', default_branch: 'develop', last_indexed_commit: 'abc', github_auth_type: 'pat', created_at: '2026-01-01', updated_at: '2026-01-02' }, error: null }
      mockClient = createMockClient(updated)
      provider = new SupabaseStorageProvider(mockClient as never)

      const result = await provider.updateRepository('repo-1', { defaultBranch: 'develop' } as Partial<import('@/types/repository').Repository>)
      expect(result.defaultBranch).toBe('develop')
      expect(mockClient.from).toHaveBeenCalledWith('repositories')
    })

    it('getRepository returns null when not found', async () => {
      mockClient = createMockClient({ data: null, error: null })
      const userClient = createMockClient({ data: null, error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      const result = await provider.getRepository('missing', userClient as never)
      expect(result).toBeNull()
    })

    it('getRepository returns camelCase repo when found', async () => {
      const repo = { data: { id: 'repo-1', org_id: 'org-1', name: 'repo', full_name: 'owner/repo', url: 'https://github.com/owner/repo', default_branch: 'main', last_indexed_commit: null, github_auth_type: 'pat', created_at: '2026-01-01', updated_at: '2026-01-01' }, error: null }
      const userClient = createMockClient(repo)
      provider = new SupabaseStorageProvider(mockClient as never)

      const result = await provider.getRepository('repo-1', userClient as never)
      expect(result).not.toBeNull()
      expect(result!.fullName).toBe('owner/repo')
    })

    it('getSettings returns null when not found', async () => {
      mockClient = createMockClient({ data: null, error: null })
      const userClient = createMockClient({ data: null, error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      const result = await provider.getSettings('missing', userClient as never)
      expect(result).toBeNull()
    })

    it('getSettings returns camelCase settings when found', async () => {
      const settings = { data: { id: 's-1', repo_id: 'repo-1', branch_filter: ['main'], include_patterns: ['*.ts'], exclude_patterns: [], embedding_provider: 'openai', embedding_model: 'text-embedding-3-small', auto_index_on_add: true, created_at: '2026-01-01', updated_at: '2026-01-01' }, error: null }
      const userClient = createMockClient(settings)
      provider = new SupabaseStorageProvider(mockClient as never)

      const result = await provider.getSettings('repo-1', userClient as never)
      expect(result).not.toBeNull()
      expect(result!.embeddingProvider).toBe('openai')
      expect(result!.autoIndexOnAdd).toBe(true)
    })

    it('bulkSetCachedFiles upserts multiple files', async () => {
      mockClient = createMockClient({ data: null, error: null })
      provider = new SupabaseStorageProvider(mockClient as never)

      await provider.bulkSetCachedFiles('repo-1', [
        { repoId: 'repo-1', filePath: 'a.ts', content: 'a', sha: 'sha1', language: 'typescript', sizeBytes: 10, isGenerated: false },
        { repoId: 'repo-1', filePath: 'b.ts', content: 'b', sha: 'sha2', language: 'typescript', sizeBytes: 20, isGenerated: false },
      ])
      expect(mockClient.from).toHaveBeenCalledWith('cached_files')
    })
  })

  describe('Error handling', () => {
    it('throws with operation name on error', async () => {
      mockClient = createMockClient({ data: null, error: { message: 'permission denied' } })
      provider = new SupabaseStorageProvider(mockClient as never)

      await expect(provider.deleteRepository('repo-1')).rejects.toThrow('Storage error in deleteRepository: permission denied')
    })

    it('throws with stringified error when no message', async () => {
      mockClient = createMockClient({ data: null, error: 'unexpected' })
      provider = new SupabaseStorageProvider(mockClient as never)

      await expect(provider.deleteChunksByRepo('repo-1')).rejects.toThrow('Storage error in deleteChunksByRepo: unexpected')
    })
  })
})
