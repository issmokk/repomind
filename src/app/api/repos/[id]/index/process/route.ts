import { NextResponse, type NextRequest } from 'next/server'
import { getRepoContext } from '../../../_helpers'
import { processNextBatch } from '@/lib/indexer/pipeline'
import { GitHubClient, PersonalAccessTokenAuth, GitHubFileCache } from '@/lib/github'
import { createEmbeddingProvider } from '@/lib/indexer/embedding'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getRepoContext(id)
  if (ctx instanceof NextResponse) return ctx

  const activeJob = await ctx.storage.getActiveJob(id)
  if (!activeJob) {
    const latestJob = await ctx.storage.getLatestJob(id, ctx.supabase)
    return NextResponse.json(latestJob ?? { status: 'none' })
  }

  const ghAuth = new PersonalAccessTokenAuth()
  const ghClient = new GitHubClient(ghAuth)
  const fileCache = new GitHubFileCache(ghClient, ctx.storage)
  const settings = await ctx.storage.getSettings(id, ctx.supabase)
  const teamSettings = await ctx.storage.getTeamSettingsDecrypted(ctx.orgId)
  const embeddingProvider = createEmbeddingProvider(settings?.embeddingProvider ?? 'ollama', {
    geminiApiKey: teamSettings.geminiApiKey ?? undefined,
    geminiEmbeddingModel: teamSettings.geminiEmbeddingModel,
    ollamaModel: teamSettings.ollamaModel,
    ollamaBaseUrl: teamSettings.ollamaBaseUrl,
  })

  const result = await processNextBatch(
    activeJob.id, id, ctx.storage, ghClient, fileCache, embeddingProvider,
  )

  return NextResponse.json(result.job, {
    headers: { 'Retry-After': '2' },
  })
}
