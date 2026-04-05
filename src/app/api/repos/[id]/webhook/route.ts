import { NextResponse, type NextRequest } from 'next/server'
import { getRepoContext } from '../../_helpers'
import { createGitHubAuth, GitHubClient } from '@/lib/github'
import { getWebhookUrl } from '@/lib/github/webhook-url'

export type WebhookInfoResponse = {
  webhookUrl: string
  secretConfigured: boolean
  existingHook: { id: number; active: boolean } | null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getRepoContext(id)
  if (ctx instanceof NextResponse) return ctx

  const { repo } = ctx
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET

  let webhookUrl: string
  try {
    webhookUrl = getWebhookUrl()
  } catch {
    return NextResponse.json(
      { error: 'App URL not configured (NEXT_PUBLIC_APP_URL or VERCEL_URL required)' },
      { status: 500 },
    )
  }

  const [owner, name] = repo.fullName.split('/')
  const auth = createGitHubAuth(repo.githubAuthType, {
    installationId: repo.githubAppInstallationId ?? undefined,
  })
  const gh = new GitHubClient(auth)

  let existingHook: { id: number; active: boolean } | null = null
  try {
    const hooks = await gh.listWebhooks(owner, name)
    const match = hooks.find((h) => h.config.url === webhookUrl)
    if (match) {
      existingHook = { id: match.id, active: match.active }
    }
  } catch {
    // Listing hooks requires admin access; PAT repos may not have it
  }

  return NextResponse.json({
    webhookUrl,
    secretConfigured: !!secret,
    existingHook,
  } satisfies WebhookInfoResponse)
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getRepoContext(id)
  if (ctx instanceof NextResponse) return ctx

  const { repo } = ctx
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET

  if (!secret) {
    return NextResponse.json(
      { error: 'GITHUB_APP_WEBHOOK_SECRET is not configured on the server' },
      { status: 500 },
    )
  }

  let webhookUrl: string
  try {
    webhookUrl = getWebhookUrl()
  } catch {
    return NextResponse.json(
      { error: 'App URL not configured (NEXT_PUBLIC_APP_URL or VERCEL_URL required)' },
      { status: 500 },
    )
  }

  const [owner, name] = repo.fullName.split('/')
  const auth = createGitHubAuth(repo.githubAuthType, {
    installationId: repo.githubAppInstallationId ?? undefined,
  })
  const gh = new GitHubClient(auth)

  try {
    const hooks = await gh.listWebhooks(owner, name)
    const existing = hooks.find((h) => h.config.url === webhookUrl)
    if (existing) {
      return NextResponse.json({
        ok: true,
        hookId: existing.id,
        alreadyExists: true,
      })
    }
  } catch {
    // If we can't list, try creating anyway
  }

  try {
    const hook = await gh.createWebhook(owner, name, webhookUrl, secret)
    return NextResponse.json({ ok: true, hookId: hook.id, alreadyExists: false })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('404') || message.includes('not found')) {
      return NextResponse.json(
        { error: 'Repository not found or insufficient permissions. Admin access is required to manage webhooks.' },
        { status: 403 },
      )
    }
    return NextResponse.json(
      { error: `Failed to create webhook: ${message}` },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getRepoContext(id)
  if (ctx instanceof NextResponse) return ctx

  const { repo } = ctx

  let webhookUrl: string
  try {
    webhookUrl = getWebhookUrl()
  } catch {
    return NextResponse.json(
      { error: 'App URL not configured' },
      { status: 500 },
    )
  }

  const [owner, name] = repo.fullName.split('/')
  const auth = createGitHubAuth(repo.githubAuthType, {
    installationId: repo.githubAppInstallationId ?? undefined,
  })
  const gh = new GitHubClient(auth)

  try {
    const hooks = await gh.listWebhooks(owner, name)
    const match = hooks.find((h) => h.config.url === webhookUrl)
    if (!match) {
      return NextResponse.json({ ok: true, message: 'No matching webhook found' })
    }
    await gh.deleteWebhook(owner, name, match.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to delete webhook: ${message}` },
      { status: 500 },
    )
  }
}
