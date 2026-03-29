import type { SupabaseClient } from '@supabase/supabase-js'
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

export interface StorageProvider {
  createRepository(data: NewRepository): Promise<Repository>
  getRepositories(userClient: SupabaseClient): Promise<Repository[]>
  getRepository(repoId: string, userClient: SupabaseClient): Promise<Repository | null>
  deleteRepository(repoId: string): Promise<void>
  updateRepository(repoId: string, data: Partial<Repository>): Promise<Repository>

  createDefaultSettings(repoId: string): Promise<RepositorySettings>
  getSettings(repoId: string, userClient: SupabaseClient): Promise<RepositorySettings | null>
  updateSettings(repoId: string, data: RepositorySettingsUpdate): Promise<RepositorySettings>

  getCachedFile(repoId: string, filePath: string): Promise<CachedFile | null>
  setCachedFile(repoId: string, file: CachedFileUpsert): Promise<void>
  bulkSetCachedFiles(repoId: string, files: CachedFileUpsert[]): Promise<void>
  bulkInvalidateCache(repoId: string): Promise<void>

  upsertChunks(chunks: ChunkUpsert[]): Promise<void>
  deleteChunksByFile(repoId: string, filePath: string): Promise<void>
  deleteChunksByRepo(repoId: string): Promise<void>

  upsertEdges(edges: GraphEdgeInsert[]): Promise<void>
  deleteEdgesByFile(repoId: string, filePath: string): Promise<void>
  deleteEdgesByRepo(repoId: string): Promise<void>
  queryEdgesBySource(repoId: string, sourceFile: string, sourceSymbol: string): Promise<GraphEdge[]>
  queryEdgesByTarget(repoId: string, targetFile: string, targetSymbol: string): Promise<GraphEdge[]>

  createJob(data: NewIndexingJob): Promise<IndexingJob>
  updateJobStatus(jobId: string, status: IndexingJobStatus, extra?: Partial<IndexingJob>): Promise<void>
  updateJobProgress(jobId: string, progress: JobProgressUpdate): Promise<void>
  getActiveJob(repoId: string): Promise<IndexingJob | null>
  getLatestJob(repoId: string, userClient: SupabaseClient): Promise<IndexingJob | null>
  markJobStale(job: IndexingJob): Promise<void>
}
