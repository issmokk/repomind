import { NextResponse, type NextRequest } from 'next/server'
import { getRepoContext } from '../../_helpers'
import { createGitHubAuth, GitHubClient } from '@/lib/github'

export type FreshnessResponse = {
  behind: number
  lastIndexedCommit: string
  headSha: string
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getRepoContext(id)
  if (ctx instanceof NextResponse) return ctx

  const { repo } = ctx

  if (!repo.lastIndexedCommit) {
    return NextResponse.json({ behind: null, lastIndexedCommit: null, headSha: null })
  }

  const [owner, name] = repo.fullName.split('/')
  const auth = createGitHubAuth(repo.githubAuthType, {
    installationId: repo.githubAppInstallationId ?? undefined,
  })
  const gh = new GitHubClient(auth)

  try {
    const result = await gh.getCommitsBehind(owner, name, repo.lastIndexedCommit, repo.defaultBranch)
    return NextResponse.json({
      behind: result.behind,
      lastIndexedCommit: repo.lastIndexedCommit,
      headSha: result.headSha,
    } satisfies FreshnessResponse)
  } catch {
    return NextResponse.json(
      { error: 'Failed to check freshness against GitHub' },
      { status: 502 },
    )
  }
}
