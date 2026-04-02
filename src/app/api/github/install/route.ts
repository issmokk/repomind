import { type NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/app/api/repos/_helpers'
import { GitHubAppAuth } from '@/lib/github/app-auth'
import { inngest } from '@/lib/inngest/client'
import { SupabaseStorageProvider } from '@/lib/storage/supabase'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext()
  if (ctx instanceof NextResponse) return ctx

  const installationId = request.nextUrl.searchParams.get('installation_id')
  if (!installationId) {
    const errorUrl = new URL('/dashboard?error=missing_installation_id', request.nextUrl.origin)
    return NextResponse.redirect(errorUrl)
  }

  const auth = new GitHubAppAuth(Number(installationId))
  const repos = await auth.getInstallationRepos()

  const storage = new SupabaseStorageProvider()
  const createdRepos: Array<{ id: string }> = []

  for (const repo of repos) {
    try {
      const created = await storage.createRepository({
        orgId: ctx.orgId,
        name: repo.name,
        fullName: repo.fullName,
        url: repo.url,
        defaultBranch: repo.defaultBranch,
        lastIndexedCommit: null,
        githubAuthType: 'github_app',
      })
      createdRepos.push(created)
    } catch {
      // Repo may already exist (conflict), skip
    }
  }

  for (const repo of createdRepos) {
    await inngest.send({
      name: 'repo/index',
      data: {
        repoId: repo.id,
        jobId: '', // Job will be created by the Inngest function or caller
        triggerType: 'install',
      },
    })
  }

  return NextResponse.redirect(new URL('/dashboard', request.nextUrl.origin))
}
