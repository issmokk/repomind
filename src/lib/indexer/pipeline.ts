import type { StorageProvider } from '@/lib/storage/types'
import type { GitHubClient } from '@/lib/github/client'
import type { GitHubFileCache } from '@/lib/github/cache'
import type { EmbeddingProvider } from './embedding/types'
import type {
  IndexingJob,
  ProcessBatchResult,
  StartJobOptions,
  FileToProcess,
  ChunkUpsert,
} from '@/types/indexing'
import type { Repository } from '@/types/repository'
import { shouldIndexFile } from './file-filter'
import { parseCode, initTreeSitter, getLanguage } from './parser'
import { detectLanguage, extractSymbols, extractImports, extractCallSites, extractInheritance } from './ast-analyzer'
import { chunkFile } from './chunker'
import { buildGraphEdges, type ASTAnalysisResult } from './graph-builder'

const STALE_THRESHOLD_MS = 5 * 60 * 1000
const DEFAULT_BATCH_SIZE = 5

export class PipelineError extends Error {
  constructor(message: string, public statusCode: number = 500) {
    super(message)
    this.name = 'PipelineError'
  }
}

export type BatchResult = {
  processed: number
  failed: number
  errors: Array<{ error: string; file?: string; timestamp: string }>
}

export async function processBatchOfFiles(
  files: FileToProcess[],
  repoId: string,
  storage: StorageProvider,
  githubClient: GitHubClient,
  fileCache: GitHubFileCache,
  embeddingProvider: EmbeddingProvider,
  context: { owner: string; repoName: string; defaultBranch: string; fileTree: string[] },
): Promise<BatchResult> {
  let processed = 0
  let failed = 0
  const errors: BatchResult['errors'] = []

  for (const file of files) {
    try {
      if (file.status === 'removed') {
        await storage.deleteChunksByFile(repoId, file.path)
        await storage.deleteEdgesByFile(repoId, file.path)
        processed++
        continue
      }

      if (file.status === 'renamed' && file.previousPath) {
        await storage.deleteChunksByFile(repoId, file.previousPath)
        await storage.deleteEdgesByFile(repoId, file.previousPath)
      }

      if (file.status === 'modified') {
        await storage.deleteChunksByFile(repoId, file.path)
        await storage.deleteEdgesByFile(repoId, file.path)
      }

      const content = await fileCache.fetchOrCacheFile(
        repoId, context.owner, context.repoName, file.path, context.defaultBranch, file.sha,
      )

      const language = detectLanguage(file.path) ?? 'unknown'

      let tree
      let langObj
      try {
        await initTreeSitter()
        tree = await parseCode(content.content, language)
        langObj = await getLanguage(language)
      } catch {
        tree = null
        langObj = undefined
      }

      const symbols = tree ? await extractSymbols(tree as never, language, file.path, langObj as never) : []
      const chunks = await chunkFile(content.content, symbols, file.path, language)

      if (chunks.length > 0) {
        const contextTexts = chunks.map((c) => c.contextualizedContent)
        const embeddings = await embeddingProvider.embed(contextTexts)

        const chunkUpserts: ChunkUpsert[] = chunks.map((chunk, i) => ({
          repoId,
          filePath: file.path,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          contextualizedContent: chunk.contextualizedContent,
          language: chunk.language,
          symbolName: chunk.symbolName,
          symbolType: chunk.symbolType,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          parentScope: chunk.parentScope,
          commitSha: file.sha,
          embedding: embeddings[i] ?? null,
          embeddingModel: embeddingProvider.name,
        }))

        await storage.upsertChunks(chunkUpserts)
      }

      const imports = tree && langObj ? await extractImports(tree as never, language, file.path, langObj as never) : []
      const callSites = tree && langObj ? await extractCallSites(tree as never, language, file.path, langObj as never) : []
      const inheritanceRaw = tree && langObj ? await extractInheritance(tree as never, language, file.path, langObj as never) : []

      const analysisResult: ASTAnalysisResult = {
        imports,
        callSites,
        inheritance: inheritanceRaw.filter((i) => i.kind === 'extends'),
        composition: inheritanceRaw.filter((i) => i.kind === 'includes' || i.kind === 'extend_module' || i.kind === 'implements'),
      }

      const edges = buildGraphEdges(file.path, analysisResult, { repoId, fileTree: context.fileTree, language })
      if (edges.length > 0) {
        await storage.upsertEdges(edges)
      }

      processed++
    } catch (err) {
      failed++
      errors.push({
        error: (err as Error).message,
        file: file.path,
        timestamp: new Date().toISOString(),
      })
    }
  }

  return { processed, failed, errors }
}

export function getAdaptiveBatchSize(totalFiles: number): number {
  if (totalFiles <= 500) return 5
  if (totalFiles <= 1000) return 10
  return 20
}

export async function startIndexingJob(
  repo: Repository,
  storage: StorageProvider,
  githubClient: GitHubClient,
  fileCache: GitHubFileCache,
  embeddingProvider: EmbeddingProvider,
  options: StartJobOptions = { triggerType: 'manual' },
): Promise<IndexingJob> {
  const activeJob = await storage.getActiveJob(repo.id)
  if (activeJob) {
    throw new PipelineError('Indexing already in progress for this repository', 409)
  }

  const [owner, repoName] = repo.fullName.split('/')
  const metadata = await githubClient.getRepoMetadata(owner, repoName)
  const headBranch = repo.defaultBranch || metadata.defaultBranch

  const fileTree = await githubClient.getFileTree(owner, repoName, headBranch)
  const _headCommitSha = fileTree.length > 0 ? fileTree[0].sha : headBranch

  let _headSha: string
  try {
    const _comparison = await githubClient.compareCommits(owner, repoName, headBranch, headBranch)
    _headSha = headBranch
  } catch {
    _headSha = headBranch
  }

  let job: IndexingJob
  try {
    job = await storage.createJob({
      repoId: repo.id,
      triggerType: options.triggerType,
      toCommit: headBranch,
      fromCommit: repo.lastIndexedCommit,
    })
  } catch (err) {
    const msg = (err as Error).message ?? ''
    if (msg.includes('23505') || msg.includes('unique') || msg.includes('duplicate')) {
      throw new PipelineError('Indexing already in progress for this repository', 409)
    }
    throw err
  }

  let filesToProcess: FileToProcess[]

  if (!repo.lastIndexedCommit) {
    await storage.bulkInvalidateCache(repo.id)
    await storage.updateJobStatus(job.id, 'fetching_files')

    const allFiles = fileTree
    filesToProcess = allFiles
      .filter((entry) => shouldIndexFile(entry.path, undefined, { sizeBytes: entry.size }).index)
      .map((entry) => ({ path: entry.path, sha: entry.sha, status: 'added' as const }))
  } else {
    await storage.updateJobStatus(job.id, 'fetching_files')

    const diff = await githubClient.compareCommits(owner, repoName, repo.lastIndexedCommit, headBranch)
    filesToProcess = diff
      .filter((entry) => {
        if (entry.status === 'removed') return true
        return shouldIndexFile(entry.filename, undefined, { sizeBytes: 0 }).index
      })
      .map((entry) => ({
        path: entry.filename,
        sha: entry.sha,
        status: entry.status,
        previousPath: entry.previousFilename,
      }))
  }

  await storage.updateJobStatus(job.id, 'processing', {
    totalFiles: filesToProcess.length,
    errorLog: [],
  } as Partial<IndexingJob>)

  // Store file list in job metadata for processNextBatch recovery (legacy path).
  // The Inngest function (index-repo.ts) does NOT use this; it passes files via step state.
  // This will be removed in section-02 when processNextBatch is retired from the SSE loop.
  await storage.updateJobStatus(job.id, 'processing', {
    errorLog: [{ error: '__files__', file: JSON.stringify(filesToProcess), timestamp: '' }],
  } as Partial<IndexingJob>)

  try {
    await embeddingProvider.validateDimensions()
  } catch (err) {
    await storage.updateJobStatus(job.id, 'failed', {
      errorLog: [{ error: `Embedding validation failed: ${(err as Error).message}`, timestamp: new Date().toISOString() }],
      completedAt: new Date().toISOString(),
    } as Partial<IndexingJob>)
    return { ...job, status: 'failed' }
  }

  const result = await processNextBatch(
    job.id, repo.id, storage, githubClient, fileCache, embeddingProvider,
    { batchSize: options.batchSize ?? DEFAULT_BATCH_SIZE },
  )

  return result.job
}

export async function processNextBatch(
  jobId: string,
  repoId: string,
  storage: StorageProvider,
  githubClient: GitHubClient,
  fileCache: GitHubFileCache,
  embeddingProvider: EmbeddingProvider,
  options: { batchSize?: number } = {},
): Promise<ProcessBatchResult> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE

  const currentJob = await storage.getActiveJob(repoId)
  if (!currentJob || currentJob.id !== jobId) {
    const latestJob = currentJob ?? ({ id: jobId, status: 'completed' } as IndexingJob)
    return { job: latestJob, hasMore: false }
  }

  if (currentJob.lastHeartbeatAt) {
    const heartbeatAge = Date.now() - new Date(currentJob.lastHeartbeatAt).getTime()
    if (heartbeatAge > STALE_THRESHOLD_MS) {
      await storage.markJobStale(currentJob)
      return { job: { ...currentJob, status: 'failed' }, hasMore: false }
    }
  }

  await storage.updateJobProgress(jobId, { currentFile: null })

  const repo = await storage.getRepository(repoId)
  if (!repo) throw new PipelineError('Repository not found', 404)

  const [owner, repoName] = repo.fullName.split('/')

  const filesEntry = currentJob.errorLog?.find((e) => e.error === '__files__')
  let filesToProcess: FileToProcess[] = []
  if (filesEntry?.file) {
    try { filesToProcess = JSON.parse(filesEntry.file) } catch { /* empty */ }
  }

  const startIdx = currentJob.processedFiles + currentJob.failedFiles
  const batch = filesToProcess.slice(startIdx, startIdx + batchSize)

  if (batch.length === 0) {
    return finishJob(jobId, repoId, currentJob, storage, repo.defaultBranch)
  }

  const fileTree = filesToProcess.map((f) => f.path)
  const batchResult = await processBatchOfFiles(
    batch, repoId, storage, githubClient, fileCache, embeddingProvider,
    { owner, repoName, defaultBranch: repo.defaultBranch, fileTree },
  )

  const processedCount = currentJob.processedFiles + batchResult.processed
  const failedCount = currentJob.failedFiles + batchResult.failed
  const realErrors = (currentJob.errorLog ?? []).filter((e) => e.error !== '__files__')

  await storage.updateJobProgress(jobId, {
    processedFiles: processedCount,
    failedFiles: failedCount,
  })

  const totalProcessed = processedCount + failedCount
  const hasMore = totalProcessed < filesToProcess.length

  if (!hasMore) {
    return finishJob(jobId, repoId, { ...currentJob, processedFiles: processedCount, failedFiles: failedCount }, storage, repo.defaultBranch)
  }

  const updatedJob: IndexingJob = {
    ...currentJob,
    processedFiles: processedCount,
    failedFiles: failedCount,
    errorLog: [...realErrors, ...batchResult.errors, ...(filesEntry ? [filesEntry] : [])],
    status: 'processing',
  }

  return { job: updatedJob, hasMore }
}

async function finishJob(
  jobId: string, repoId: string, currentJob: IndexingJob,
  storage: StorageProvider, commitRef: string,
): Promise<ProcessBatchResult> {
  const finalStatus = currentJob.failedFiles > 0 ? 'partial' : 'completed'
  await storage.updateJobStatus(jobId, finalStatus as IndexingJob['status'], {
    completedAt: new Date().toISOString(),
  } as Partial<IndexingJob>)
  await storage.updateRepository(repoId, { lastIndexedCommit: commitRef } as Partial<Repository>)
  return { job: { ...currentJob, status: finalStatus as IndexingJob['status'] }, hasMore: false }
}

export async function checkAndMarkStaleJob(
  repoId: string,
  storage: StorageProvider,
): Promise<IndexingJob | null> {
  const activeJob = await storage.getActiveJob(repoId)
  if (!activeJob) return null

  if (activeJob.lastHeartbeatAt) {
    const heartbeatAge = Date.now() - new Date(activeJob.lastHeartbeatAt).getTime()
    if (heartbeatAge > STALE_THRESHOLD_MS) {
      await storage.markJobStale(activeJob)
      return { ...activeJob, status: 'failed' }
    }
  }

  return activeJob
}
