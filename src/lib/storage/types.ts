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
import type { TeamSettings, TeamSettingsUpdate } from '@/types/settings'
import type { HybridSearchResult, NewChatMessage, ChatMessage, NewQueryFeedback } from '@/lib/rag/types'

export interface StorageProvider {
  createRepository(data: NewRepository): Promise<Repository>
  getRepositories(userClient: SupabaseClient): Promise<Repository[]>
  getRepository(repoId: string, userClient?: SupabaseClient): Promise<Repository | null>
  findRepositoryByFullName(fullName: string): Promise<Repository | null>
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

  hybridSearchChunks(
    queryEmbedding: number[],
    queryText: string,
    repoIds: string[],
    orgId: string,
    options?: { topK?: number; rrfK?: number; overfetchFactor?: number }
  ): Promise<HybridSearchResult[]>

  getRelatedEdgesBatch(
    repoId: string,
    sources: Array<{ filePath: string; symbolName: string }>,
    options?: { depth?: number }
  ): Promise<Array<{ source: { filePath: string; symbolName: string }; edges: GraphEdge[]; hop: number }>>

  saveMessage(data: NewChatMessage): Promise<ChatMessage>

  getMessages(
    userId: string,
    orgId: string,
    userClient: SupabaseClient,
    options?: { limit?: number; offset?: number }
  ): Promise<ChatMessage[]>

  saveFeedback(data: NewQueryFeedback): Promise<void>

  getTeamSettings(orgId: string): Promise<TeamSettings>
  getTeamSettingsDecrypted(orgId: string): Promise<TeamSettings>

  updateTeamSettings(orgId: string, data: TeamSettingsUpdate): Promise<TeamSettings>
}
