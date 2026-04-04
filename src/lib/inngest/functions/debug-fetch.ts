import { inngest } from '../client'

export const debugFetchFunction = inngest.createFunction(
  {
    id: 'debug-fetch',
    name: 'Debug Fetch',
    triggers: [{ event: 'debug/fetch' }],
  },
  async ({ step }) => {
    const envCheck = await step.run('check-env', async () => {
      return {
        hasGithubPat: !!process.env.GITHUB_PAT,
        patPrefix: process.env.GITHUB_PAT?.substring(0, 10) ?? 'MISSING',
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        nodeVersion: process.version,
      }
    })

    const dnsCheck = await step.run('dns-resolve', async () => {
      try {
        const { resolve4 } = await import('node:dns/promises')
        const addresses = await resolve4('api.github.com')
        return { success: true, addresses }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    })

    const rawFetch = await step.run('raw-fetch-github', async () => {
      try {
        const res = await fetch('https://api.github.com/rate_limit', {
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_PAT}`,
            Accept: 'application/vnd.github+json',
          },
          signal: AbortSignal.timeout(10_000),
        })
        const body = await res.text()
        return {
          success: true,
          status: res.status,
          bodyLength: body.length,
          bodyPreview: body.substring(0, 200),
        }
      } catch (err) {
        const cause = (err as Error).cause
        return {
          success: false,
          error: (err as Error).message,
          cause: cause instanceof Error ? cause.message : String(cause ?? 'none'),
          stack: (err as Error).stack?.substring(0, 300),
        }
      }
    })

    const blobFetch = await step.run('fetch-blob-api', async () => {
      try {
        const treeRes = await fetch('https://api.github.com/repos/issmokk/repomind/git/trees/main?recursive=1', {
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_PAT}`,
            Accept: 'application/vnd.github+json',
          },
          signal: AbortSignal.timeout(15_000),
        })
        if (!treeRes.ok) return { success: false, error: `Tree API: ${treeRes.status}` }
        const tree = await treeRes.json() as { tree: Array<{ path: string; sha: string; type: string }> }
        const firstBlob = tree.tree.find((f: { type: string }) => f.type === 'blob')
        if (!firstBlob) return { success: false, error: 'No blobs in tree' }

        const blobRes = await fetch(`https://api.github.com/repos/issmokk/repomind/git/blobs/${firstBlob.sha}`, {
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_PAT}`,
            Accept: 'application/vnd.github+json',
          },
          signal: AbortSignal.timeout(15_000),
        })
        return {
          success: blobRes.ok,
          status: blobRes.status,
          file: firstBlob.path,
          blobSha: firstBlob.sha,
          bodyLength: (await blobRes.text()).length,
        }
      } catch (err) {
        const cause = (err as Error).cause
        return {
          success: false,
          error: (err as Error).message,
          cause: cause instanceof Error ? cause.message : String(cause ?? 'none'),
        }
      }
    })

    const contentsFetch = await step.run('fetch-contents-api', async () => {
      try {
        const res = await fetch('https://api.github.com/repos/issmokk/repomind/contents/CLAUDE.md?ref=main', {
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_PAT}`,
            Accept: 'application/vnd.github+json',
          },
          signal: AbortSignal.timeout(15_000),
        })
        return {
          success: res.ok,
          status: res.status,
          bodyLength: (await res.text()).length,
        }
      } catch (err) {
        const cause = (err as Error).cause
        return {
          success: false,
          error: (err as Error).message,
          cause: cause instanceof Error ? cause.message : String(cause ?? 'none'),
        }
      }
    })

    const supabaseFetch = await step.run('fetch-supabase', async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const client = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        )
        const { data, error } = await client
          .from('repositories')
          .select('id, full_name')
          .limit(1)
        return {
          success: !error,
          error: error?.message ?? null,
          data: data?.[0] ?? null,
        }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    })

    const fullPipelineTest = await step.run('pipeline-no-cache', async () => {
      try {
        const { GitHubClient, PersonalAccessTokenAuth } = await import('@/lib/github')

        const ghAuth = new PersonalAccessTokenAuth()
        const ghClient = new GitHubClient(ghAuth)

        const { data } = await (await import('@supabase/supabase-js')).createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        ).from('repositories').select('id, full_name, default_branch').limit(1).single()

        if (!data) return { success: false, error: 'No repos found' }

        const [owner, repo] = data.full_name.split('/')
        const tree = await ghClient.getFileTree(owner, repo, data.default_branch)
        const midFile = tree[Math.floor(tree.length / 2)]
        if (!midFile) return { success: false, error: 'Empty tree' }

        const content = await ghClient.getFileContent(owner, repo, midFile.path, data.default_branch, midFile.sha)

        return {
          success: true,
          file: midFile.path,
          contentLength: content.content.length,
          sha: content.sha,
          usedBlobApi: !!midFile.sha,
        }
      } catch (err) {
        const cause = (err as Error).cause
        return {
          success: false,
          error: (err as Error).message,
          cause: cause instanceof Error ? cause.message : String(cause ?? 'none'),
          stack: (err as Error).stack?.substring(0, 500),
        }
      }
    })

    return { envCheck, dnsCheck, rawFetch, blobFetch, contentsFetch, supabaseFetch, fullPipelineTest }
  },
)
