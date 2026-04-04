import { NextResponse, type NextRequest } from 'next/server'
import { getRepoContext } from '../../_helpers'
import { inngest } from '@/lib/inngest/client'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getRepoContext(id)
  if (ctx instanceof NextResponse) return ctx

  const activeJob = await ctx.storage.getActiveJob(id)
  if (!activeJob) {
    return NextResponse.json({ error: 'No active indexing job' }, { status: 404 })
  }

  await ctx.storage.updateJobStatus(activeJob.id, 'failed', {
    errorLog: [
      ...activeJob.errorLog,
      { error: 'Cancelled by user', timestamp: new Date().toISOString() },
    ],
    completedAt: new Date().toISOString(),
  })

  await inngest.send({ name: 'repo/index.cancel', data: { repoId: id } })

  return NextResponse.json({ success: true })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getRepoContext(id)
  if (ctx instanceof NextResponse) return ctx

  const activeJob = await ctx.storage.getActiveJob(id)
  if (activeJob) {
    return NextResponse.json({ error: 'Indexing already in progress for this repository' }, { status: 409 })
  }

  const body = await request.json().catch(() => ({}))
  const triggerType = body.trigger === 'git_diff' ? 'webhook' : 'manual'
  const retryFailed = body.retryFailed === true

  let retryFiles: string[] | undefined
  if (retryFailed) {
    const latestJob = await ctx.storage.getLatestJob(id, ctx.supabase)
    if (!latestJob || latestJob.status !== 'partial' || latestJob.failedFiles === 0) {
      return NextResponse.json({ error: 'No partial job with failed files to retry' }, { status: 400 })
    }
    retryFiles = latestJob.errorLog
      .filter((entry) => entry.file)
      .map((entry) => entry.file!)
    if (retryFiles.length === 0) {
      return NextResponse.json({ error: 'No failed file paths found in error log' }, { status: 400 })
    }
  }

  const job = await ctx.storage.createJob({
    repoId: id,
    triggerType: triggerType === 'webhook' ? 'git_diff' : 'manual',
    toCommit: ctx.repo.defaultBranch ?? 'main',
    fromCommit: ctx.repo.lastIndexedCommit,
  })

  try {
    await inngest.send({
      name: 'repo/index',
      data: {
        repoId: id,
        jobId: job.id,
        triggerType: triggerType as 'manual' | 'webhook',
        ...(retryFiles && { retryFiles }),
      },
    })
  } catch (err) {
    await ctx.storage.updateJobStatus(job.id, 'failed', {
      errorLog: [{ error: `Failed to dispatch indexing: ${(err as Error).message}`, timestamp: new Date().toISOString() }],
      completedAt: new Date().toISOString(),
    })
    return NextResponse.json({ error: 'Failed to start indexing' }, { status: 500 })
  }

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
  })
}
