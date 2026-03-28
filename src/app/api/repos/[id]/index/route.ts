import { NextResponse, type NextRequest } from 'next/server'
import { getRepoContext } from '../../_helpers'
import { startIndexingJob, PipelineError } from '@/lib/indexer/pipeline'
import { GitHubClient, PersonalAccessTokenAuth, GitHubFileCache } from '@/lib/github'
import { createEmbeddingProvider } from '@/lib/indexer/embedding'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getRepoContext(id)
  if (ctx instanceof NextResponse) return ctx

  const body = await request.json().catch(() => ({}))
  const triggerType = body.trigger === 'git_diff' ? 'git_diff' : 'manual'

  const ghAuth = new PersonalAccessTokenAuth()
  const ghClient = new GitHubClient(ghAuth)
  const fileCache = new GitHubFileCache(ghClient, ctx.storage)

  const settings = await ctx.storage.getSettings(id, ctx.supabase)
  const embeddingProvider = createEmbeddingProvider(settings?.embeddingProvider ?? 'ollama')

  try {
    const job = await startIndexingJob(ctx.repo, ctx.storage, ghClient, fileCache, embeddingProvider, {
      triggerType,
    })
    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      processedFiles: job.processedFiles,
      totalFiles: job.totalFiles,
    })
  } catch (err) {
    if (err instanceof PipelineError && err.statusCode === 409) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
