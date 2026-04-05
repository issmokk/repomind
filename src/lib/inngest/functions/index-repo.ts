import { createClient } from '@supabase/supabase-js'
import { inngest } from '../client'
import type { RepoIndexEventData } from '../client'
import { SupabaseStorageProvider } from '@/lib/storage/supabase'
import { GitHubClient, PersonalAccessTokenAuth, GitHubFileCache } from '@/lib/github'
import { createEmbeddingProvider } from '@/lib/indexer/embedding'
import { processBatchOfFiles, getAdaptiveBatchSize, PipelineError } from '@/lib/indexer/pipeline'
import { shouldIndexFile } from '@/lib/indexer/file-filter'
import type { FileToProcess } from '@/types/indexing'

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export const indexRepoFunction = inngest.createFunction(
  {
    id: 'index-repo',
    name: 'Index Repository',
    concurrency: [{ limit: 1, key: 'event.data.repoId' }],
    retries: 3,
    cancelOn: [{ event: 'repo/index.cancel', match: 'data.repoId' }],
    triggers: [{ event: 'repo/index' }],
  },
  async ({ event, step }) => {
    const { repoId, jobId, triggerType, indexMode, retryFiles } = event.data as RepoIndexEventData

    const initResult = await step.run('initialize', async () => {
      const storage = new SupabaseStorageProvider()

      const repo = await storage.getRepository(repoId)
      if (!repo) throw new PipelineError('Repository not found', 404)

      const [owner, repoName] = repo.fullName.split('/')
      const ghAuth = new PersonalAccessTokenAuth()
      const ghClient = new GitHubClient(ghAuth)

      const metadata = await ghClient.getRepoMetadata(owner, repoName)
      const headBranch = repo.defaultBranch || metadata.defaultBranch

      let filesToProcess: FileToProcess[]
      const headCommitSha = await ghClient.getBranchHeadSha(owner, repoName, headBranch)

      if (retryFiles && retryFiles.length > 0) {
        await storage.updateJobStatus(jobId, 'fetching_files')

        const fileTree = await ghClient.getFileTree(owner, repoName, headBranch)

        const retrySet = new Set(retryFiles)
        filesToProcess = fileTree
          .filter((entry) => retrySet.has(entry.path))
          .map((entry) => ({ path: entry.path, sha: entry.sha, status: 'modified' as const }))
      } else {
        const useFullIndex = !repo.lastIndexedCommit
          || indexMode === 'full'
          || (!indexMode && triggerType === 'manual')
        if (useFullIndex) {
          await storage.bulkInvalidateCache(repoId)
          await storage.updateJobStatus(jobId, 'fetching_files')

          const fileTree = await ghClient.getFileTree(owner, repoName, headBranch)

          filesToProcess = fileTree
            .filter((entry) => shouldIndexFile(entry.path, undefined, { sizeBytes: entry.size }).index)
            .map((entry) => ({ path: entry.path, sha: entry.sha, status: 'added' as const }))
        } else {
          await storage.updateJobStatus(jobId, 'fetching_files')

          let diff: Awaited<ReturnType<typeof ghClient.compareCommits>> | null = null
          try {
            diff = await ghClient.compareCommits(owner, repoName, repo.lastIndexedCommit!, headBranch)
          } catch {
            console.warn(
              `Compare failed for ${repo.fullName} (commit ${repo.lastIndexedCommit} may no longer exist). Falling back to full re-index.`,
            )
          }

          if (diff) {
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
          } else {
            await storage.bulkInvalidateCache(repoId)
            const fileTree = await ghClient.getFileTree(owner, repoName, headBranch)
            filesToProcess = fileTree
              .filter((entry) => shouldIndexFile(entry.path, undefined, { sizeBytes: entry.size }).index)
              .map((entry) => ({ path: entry.path, sha: entry.sha, status: 'added' as const }))
          }
        }
      }

      await storage.updateJobStatus(jobId, 'processing', {
        totalFiles: filesToProcess.length,
        errorLog: [],
      })

      return {
        filesToProcess,
        headCommitSha,
        owner,
        repoName,
        defaultBranch: repo.defaultBranch || headBranch,
        orgId: repo.orgId,
      }
    })

    const { filesToProcess, headCommitSha, owner, repoName, defaultBranch, orgId } = initResult
    const batchSize = getAdaptiveBatchSize(filesToProcess.length)
    const totalBatches = Math.ceil(filesToProcess.length / batchSize)

    let totalProcessed = 0
    let totalFailed = 0
    const allErrors: Array<{ error: string; file?: string; timestamp: string }> = []

    for (let i = 0; i < totalBatches; i++) {
      const batch = filesToProcess.slice(i * batchSize, (i + 1) * batchSize)
      const prevProcessed = totalProcessed
      const prevFailed = totalFailed

      const batchResult = await step.run(`batch-${i}`, async () => {
        const storage = new SupabaseStorageProvider()
        const serviceClient = createServiceClient()
        const ghAuth = new PersonalAccessTokenAuth()
        const ghClient = new GitHubClient(ghAuth)
        const fileCache = new GitHubFileCache(ghClient, storage)

        const settings = await storage.getSettings(repoId, serviceClient)
        const teamSettings = await storage.getTeamSettingsDecrypted(orgId)
        const embeddingProvider = createEmbeddingProvider(teamSettings.embeddingProvider ?? settings?.embeddingProvider ?? 'ollama', {
          geminiApiKey: teamSettings.geminiApiKey ?? undefined,
          geminiEmbeddingModel: teamSettings.geminiEmbeddingModel,
          ollamaModel: teamSettings.ollamaModel,
          ollamaBaseUrl: teamSettings.ollamaBaseUrl,
        })

        const fileTree = filesToProcess.map((f) => f.path)
        const result = await processBatchOfFiles(
          batch, repoId, storage, ghClient, fileCache, embeddingProvider,
          { owner, repoName, defaultBranch, fileTree },
        )

        await storage.updateJobProgress(jobId, {
          processedFiles: prevProcessed + result.processed,
          failedFiles: prevFailed + result.failed,
          currentFile: batch[batch.length - 1]?.path ?? null,
        })

        return result
      })

      totalProcessed += batchResult.processed
      totalFailed += batchResult.failed
      allErrors.push(...batchResult.errors)
    }

    await step.run('finalize', async () => {
      const storage = new SupabaseStorageProvider()
      const finalStatus = totalFailed > 0 ? 'partial' : 'completed'

      await storage.updateJobStatus(jobId, finalStatus, {
        completedAt: new Date().toISOString(),
        errorLog: allErrors,
      })

      await storage.updateRepository(repoId, { lastIndexedCommit: headCommitSha })
    })

    return { jobId, totalProcessed, totalFailed, errors: allErrors }
  },
)
