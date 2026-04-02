import { NextResponse, type NextRequest } from 'next/server'
import { verifyWebhookSignature } from '@/lib/github/webhook'
import { inngest } from '@/lib/inngest/client'
import { SupabaseStorageProvider } from '@/lib/storage/supabase'

export async function POST(request: NextRequest) {
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const signature = request.headers.get('x-hub-signature-256')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
  }

  const body = await request.text()

  if (!verifyWebhookSignature(body, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const eventType = request.headers.get('x-github-event')
  if (eventType !== 'push') {
    return NextResponse.json({ ok: true, skipped: `event type: ${eventType}` })
  }

  const payload = JSON.parse(body) as {
    ref: string
    after: string
    repository: { full_name: string; default_branch: string }
    commits: Array<{ added: string[]; modified: string[]; removed: string[] }>
  }

  const defaultBranchRef = `refs/heads/${payload.repository.default_branch}`
  if (payload.ref !== defaultBranchRef) {
    return NextResponse.json({ ok: true, skipped: 'non-default branch' })
  }

  const storage = new SupabaseStorageProvider()
  const repo = await storage.findRepositoryByFullName(payload.repository.full_name)
  if (!repo) {
    return NextResponse.json({ ok: true, skipped: 'unknown repo' })
  }

  if (repo.lastIndexedCommit === payload.after) {
    return NextResponse.json({ ok: true, skipped: 'duplicate commit' })
  }

  const changedFiles = [
    ...new Set(
      payload.commits.flatMap((c) => [...c.added, ...c.modified, ...c.removed]),
    ),
  ]

  const job = await storage.createJob({
    repoId: repo.id,
    triggerType: 'git_diff',
    toCommit: payload.after,
    fromCommit: repo.lastIndexedCommit,
  })

  await inngest.send({
    name: 'repo/index',
    data: {
      repoId: repo.id,
      jobId: job.id,
      triggerType: 'webhook',
      changedFiles,
    },
  })

  return NextResponse.json({ ok: true, jobId: job.id })
}
