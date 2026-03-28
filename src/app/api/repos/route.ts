import { NextResponse, type NextRequest } from 'next/server'
import { getAuthContext } from './_helpers'
import { GitHubClient, PersonalAccessTokenAuth } from '@/lib/github'

export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const { fullName, branch, authType = 'pat' } = body

  if (!fullName || !fullName.includes('/') || fullName.split('/').length !== 2) {
    return NextResponse.json({ error: 'Invalid repository name format. Expected owner/repo' }, { status: 400 })
  }

  const [owner, repoName] = fullName.split('/')
  const ghAuth = new PersonalAccessTokenAuth()
  const ghClient = new GitHubClient(ghAuth)

  let metadata
  try {
    metadata = await ghClient.getRepoMetadata(owner, repoName)
  } catch {
    return NextResponse.json({ error: 'Repository not found or not accessible with current credentials' }, { status: 400 })
  }

  const repo = await auth.storage.createRepository({
    orgId: auth.orgId,
    name: metadata.name,
    fullName: metadata.fullName,
    url: metadata.url,
    defaultBranch: branch ?? metadata.defaultBranch,
    lastIndexedCommit: null,
    githubAuthType: authType,
  })

  return NextResponse.json(repo)
}

export async function GET() {
  const auth = await getAuthContext()
  if (auth instanceof NextResponse) return auth

  const repos = await auth.storage.getRepositories(auth.supabase)

  const reposWithStatus = await Promise.all(
    repos.map(async (repo) => {
      const latestJob = await auth.storage.getLatestJob(repo.id, auth.supabase)
      return { ...repo, latestJobStatus: latestJob?.status ?? null }
    }),
  )

  return NextResponse.json(reposWithStatus)
}
