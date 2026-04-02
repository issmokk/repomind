export type IndexingJobStatus =
  | 'pending'
  | 'fetching_files'
  | 'processing'
  | 'embedding'
  | 'completed'
  | 'failed'
  | 'partial'

export type IndexingJobTrigger = 'manual' | 'git_diff' | 'webhook' | 'install'

export type IndexingJob = {
  id: string
  repoId: string
  status: IndexingJobStatus
  triggerType: IndexingJobTrigger
  fromCommit: string | null
  toCommit: string | null
  totalFiles: number
  processedFiles: number
  failedFiles: number
  currentFile: string | null
  errorLog: Array<{ error: string; file?: string; timestamp: string }>
  lastHeartbeatAt: string | null
  startedAt: string | null
  completedAt: string | null
}

export type NewIndexingJob = Pick<IndexingJob, 'repoId' | 'triggerType' | 'toCommit'> & {
  fromCommit?: string | null
}

export type JobProgressUpdate = {
  processedFiles?: number
  failedFiles?: number
  currentFile?: string | null
}

export type CodeChunk = {
  id: number
  repoId: string
  filePath: string
  chunkIndex: number
  content: string
  contextualizedContent: string
  language: string | null
  symbolName: string | null
  symbolType: string | null
  startLine: number
  endLine: number
  parentScope: string | null
  commitSha: string | null
  embedding: number[] | null
  embeddingModel: string | null
  createdAt: string
}

export type ChunkUpsert = Omit<CodeChunk, 'id' | 'createdAt'>

export type ChunkResult = {
  content: string
  contextualizedContent: string
  language: string
  symbolName: string | null
  symbolType: string | null
  startLine: number
  endLine: number
  parentScope: string | null
  chunkIndex: number
}

export type ProcessBatchResult = {
  job: IndexingJob
  hasMore: boolean
}

export type StartJobOptions = {
  triggerType: 'manual' | 'git_diff'
  batchSize?: number
}

export type FileToProcess = {
  path: string
  sha: string
  status: 'added' | 'modified' | 'removed' | 'renamed'
  previousPath?: string
}

export type FileMetadata = {
  filePath: string
  language: string | null
  sizeBytes: number | null
  isGenerated: boolean
  sha: string
}
