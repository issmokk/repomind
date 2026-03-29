import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  Repository,
  NewRepository,
  RepositorySettings,
  RepositorySettingsUpdate,
  CachedFile,
  CachedFileUpsert,
} from '@/types/repository'
import type {
  IndexingJob,
  IndexingJobStatus,
  NewIndexingJob,
  JobProgressUpdate,
  ChunkUpsert,
} from '@/types/indexing'
import type { GraphEdge, GraphEdgeInsert } from '@/types/graph'
import type { StorageProvider } from './types'

const STALE_JOB_THRESHOLD_MS = 5 * 60 * 1000
const ACTIVE_STATUSES: IndexingJobStatus[] = ['pending', 'fetching_files', 'processing', 'embedding']

function assertNoError<T>(result: { data: T; error: unknown }, operation: string): T {
  const { data, error } = result
  if (error) {
    const msg = (error as { message?: string }).message ?? String(error)
    throw new Error(`Storage error in ${operation}: ${msg}`)
  }
  return data
}

function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
    result[snakeKey] = value
  }
  return result
}

function toCamelCase<T>(obj: Record<string, unknown>): T {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    result[camelKey] = value
  }
  return result as T
}

export class SupabaseStorageProvider implements StorageProvider {
  private serviceClient: SupabaseClient

  constructor(serviceClient?: SupabaseClient) {
    this.serviceClient =
      serviceClient ??
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
  }

  async createRepository(data: NewRepository): Promise<Repository> {
    const result = await this.serviceClient
      .from('repositories')
      .insert(toSnakeCase(data as unknown as Record<string, unknown>))
      .select()
      .single()
    const repo = toCamelCase<Repository>(assertNoError(result, 'createRepository'))
    await this.createDefaultSettings(repo.id)
    return repo
  }

  async getRepositories(userClient: SupabaseClient): Promise<Repository[]> {
    const result = await userClient.from('repositories').select('*')
    const rows = assertNoError(result, 'getRepositories')
    return (rows ?? []).map((r: Record<string, unknown>) => toCamelCase<Repository>(r))
  }

  async getRepository(repoId: string, userClient: SupabaseClient): Promise<Repository | null> {
    const result = await userClient
      .from('repositories')
      .select('*')
      .eq('id', repoId)
      .maybeSingle()
    const row = assertNoError(result, 'getRepository')
    return row ? toCamelCase<Repository>(row) : null
  }

  async deleteRepository(repoId: string): Promise<void> {
    const result = await this.serviceClient
      .from('repositories')
      .delete()
      .eq('id', repoId)
    assertNoError(result, 'deleteRepository')
  }

  async updateRepository(repoId: string, data: Partial<Repository>): Promise<Repository> {
    const result = await this.serviceClient
      .from('repositories')
      .update(toSnakeCase(data as unknown as Record<string, unknown>))
      .eq('id', repoId)
      .select()
      .single()
    return toCamelCase<Repository>(assertNoError(result, 'updateRepository'))
  }

  async createDefaultSettings(repoId: string): Promise<RepositorySettings> {
    const result = await this.serviceClient
      .from('repository_settings')
      .insert({
        repo_id: repoId,
        branch_filter: ['main'],
        include_patterns: [],
        exclude_patterns: [],
        embedding_provider: 'ollama',
        embedding_model: 'gte-qwen2-1.5b-instruct',
        auto_index_on_add: false,
      })
      .select()
      .single()
    return toCamelCase<RepositorySettings>(assertNoError(result, 'createDefaultSettings'))
  }

  async getSettings(repoId: string, userClient: SupabaseClient): Promise<RepositorySettings | null> {
    const result = await userClient
      .from('repository_settings')
      .select('*')
      .eq('repo_id', repoId)
      .maybeSingle()
    const row = assertNoError(result, 'getSettings')
    return row ? toCamelCase<RepositorySettings>(row) : null
  }

  async updateSettings(repoId: string, data: RepositorySettingsUpdate): Promise<RepositorySettings> {
    const result = await this.serviceClient
      .from('repository_settings')
      .update(toSnakeCase(data as unknown as Record<string, unknown>))
      .eq('repo_id', repoId)
      .select()
      .single()
    return toCamelCase<RepositorySettings>(assertNoError(result, 'updateSettings'))
  }

  async getCachedFile(repoId: string, filePath: string): Promise<CachedFile | null> {
    const result = await this.serviceClient
      .from('cached_files')
      .select('*')
      .eq('repo_id', repoId)
      .eq('file_path', filePath)
      .maybeSingle()
    const row = assertNoError(result, 'getCachedFile')
    return row ? toCamelCase<CachedFile>(row) : null
  }

  async setCachedFile(repoId: string, file: CachedFileUpsert): Promise<void> {
    const row = { ...toSnakeCase(file as unknown as Record<string, unknown>), repo_id: repoId }
    const result = await this.serviceClient
      .from('cached_files')
      .upsert(row, { onConflict: 'repo_id,file_path' })
    assertNoError(result, 'setCachedFile')
  }

  async bulkSetCachedFiles(repoId: string, files: CachedFileUpsert[]): Promise<void> {
    const rows = files.map((f) => ({
      ...toSnakeCase(f as unknown as Record<string, unknown>),
      repo_id: repoId,
    }))
    const result = await this.serviceClient
      .from('cached_files')
      .upsert(rows, { onConflict: 'repo_id,file_path' })
    assertNoError(result, 'bulkSetCachedFiles')
  }

  async bulkInvalidateCache(repoId: string): Promise<void> {
    const result = await this.serviceClient
      .from('cached_files')
      .delete()
      .eq('repo_id', repoId)
    assertNoError(result, 'bulkInvalidateCache')
  }

  async upsertChunks(chunks: ChunkUpsert[]): Promise<void> {
    if (chunks.length === 0) return
    const rows = chunks.map((c) => toSnakeCase(c as unknown as Record<string, unknown>))
    const result = await this.serviceClient
      .from('code_chunks')
      .upsert(rows, { onConflict: 'repo_id,file_path,chunk_index' })
    assertNoError(result, 'upsertChunks')
  }

  async deleteChunksByFile(repoId: string, filePath: string): Promise<void> {
    const result = await this.serviceClient
      .from('code_chunks')
      .delete()
      .eq('repo_id', repoId)
      .eq('file_path', filePath)
    assertNoError(result, 'deleteChunksByFile')
  }

  async deleteChunksByRepo(repoId: string): Promise<void> {
    const result = await this.serviceClient
      .from('code_chunks')
      .delete()
      .eq('repo_id', repoId)
    assertNoError(result, 'deleteChunksByRepo')
  }

  async upsertEdges(edges: GraphEdgeInsert[]): Promise<void> {
    if (edges.length === 0) return
    const rows = edges.map((e) => toSnakeCase(e as unknown as Record<string, unknown>))
    const result = await this.serviceClient
      .from('graph_edges')
      .insert(rows)
    assertNoError(result, 'upsertEdges')
  }

  async deleteEdgesByFile(repoId: string, filePath: string): Promise<void> {
    const r1 = await this.serviceClient
      .from('graph_edges')
      .delete()
      .eq('repo_id', repoId)
      .eq('source_file', filePath)
    assertNoError(r1, 'deleteEdgesByFile(source)')

    const r2 = await this.serviceClient
      .from('graph_edges')
      .delete()
      .eq('repo_id', repoId)
      .eq('target_file', filePath)
    assertNoError(r2, 'deleteEdgesByFile(target)')
  }

  async deleteEdgesByRepo(repoId: string): Promise<void> {
    const result = await this.serviceClient
      .from('graph_edges')
      .delete()
      .eq('repo_id', repoId)
    assertNoError(result, 'deleteEdgesByRepo')
  }

  async queryEdgesBySource(repoId: string, sourceFile: string, sourceSymbol: string): Promise<GraphEdge[]> {
    const result = await this.serviceClient
      .from('graph_edges')
      .select('*')
      .eq('repo_id', repoId)
      .eq('source_file', sourceFile)
      .eq('source_symbol', sourceSymbol)
    const rows = assertNoError(result, 'queryEdgesBySource')
    return (rows ?? []).map((r: Record<string, unknown>) => toCamelCase<GraphEdge>(r))
  }

  async queryEdgesByTarget(repoId: string, targetFile: string, targetSymbol: string): Promise<GraphEdge[]> {
    const result = await this.serviceClient
      .from('graph_edges')
      .select('*')
      .eq('repo_id', repoId)
      .eq('target_file', targetFile)
      .eq('target_symbol', targetSymbol)
    const rows = assertNoError(result, 'queryEdgesByTarget')
    return (rows ?? []).map((r: Record<string, unknown>) => toCamelCase<GraphEdge>(r))
  }

  async createJob(data: NewIndexingJob): Promise<IndexingJob> {
    const result = await this.serviceClient
      .from('indexing_jobs')
      .insert({
        ...toSnakeCase(data as unknown as Record<string, unknown>),
        status: 'pending',
      })
      .select()
      .single()
    return toCamelCase<IndexingJob>(assertNoError(result, 'createJob'))
  }

  async updateJobStatus(jobId: string, status: IndexingJobStatus, extra?: Partial<IndexingJob>): Promise<void> {
    const updateData: Record<string, unknown> = { status }
    if (extra) {
      Object.assign(updateData, toSnakeCase(extra as unknown as Record<string, unknown>))
    }
    const result = await this.serviceClient
      .from('indexing_jobs')
      .update(updateData)
      .eq('id', jobId)
    assertNoError(result, 'updateJobStatus')
  }

  async updateJobProgress(jobId: string, progress: JobProgressUpdate): Promise<void> {
    const updateData = {
      ...toSnakeCase(progress as unknown as Record<string, unknown>),
      last_heartbeat_at: new Date().toISOString(),
    }
    const result = await this.serviceClient
      .from('indexing_jobs')
      .update(updateData)
      .eq('id', jobId)
    assertNoError(result, 'updateJobProgress')
  }

  async getActiveJob(repoId: string): Promise<IndexingJob | null> {
    const result = await this.serviceClient
      .from('indexing_jobs')
      .select('*')
      .eq('repo_id', repoId)
      .in('status', ACTIVE_STATUSES)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const row = assertNoError(result, 'getActiveJob')
    return row ? toCamelCase<IndexingJob>(row) : null
  }

  async getLatestJob(repoId: string, userClient: SupabaseClient): Promise<IndexingJob | null> {
    const result = await userClient
      .from('indexing_jobs')
      .select('*')
      .eq('repo_id', repoId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const row = assertNoError(result, 'getLatestJob')
    return row ? toCamelCase<IndexingJob>(row) : null
  }

  async markJobStale(job: IndexingJob): Promise<void> {
    if (!job.lastHeartbeatAt) return

    const heartbeatAge = Date.now() - new Date(job.lastHeartbeatAt).getTime()
    if (heartbeatAge <= STALE_JOB_THRESHOLD_MS) return

    const errorEntry = {
      error: 'stale: no heartbeat for over 5 minutes',
      timestamp: new Date().toISOString(),
    }
    const errorLog = [...(job.errorLog ?? []), errorEntry]

    const result = await this.serviceClient
      .from('indexing_jobs')
      .update({
        status: 'failed',
        error_log: errorLog,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)
    assertNoError(result, 'markJobStale')
  }
}
