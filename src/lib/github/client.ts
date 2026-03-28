import type { GitHubAuthProvider, RepoInfo, FileTreeEntry, DiffEntry, FileContent } from './types'

const RATE_LIMIT_THRESHOLD = 100

export class GitHubClient {
  constructor(
    private auth: GitHubAuthProvider,
    private baseUrl = 'https://api.github.com',
  ) {}

  async getRepoMetadata(owner: string, repo: string): Promise<RepoInfo> {
    const data = await this.request(`/repos/${owner}/${repo}`)
    return {
      name: data.name,
      fullName: data.full_name,
      defaultBranch: data.default_branch,
      url: data.html_url,
      private: data.private,
    }
  }

  async getFileTree(owner: string, repo: string, sha: string): Promise<FileTreeEntry[]> {
    const data = await this.request(
      `/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`,
    )
    if (data.truncated) {
      console.warn(`File tree for ${owner}/${repo} was truncated (>100k entries)`)
    }
    return (data.tree as Array<{ path: string; sha: string; size: number; type: string }>)
      .filter((entry) => entry.type === 'blob')
      .map((entry) => ({
        path: entry.path,
        sha: entry.sha,
        size: entry.size ?? 0,
        type: 'blob' as const,
      }))
  }

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref: string,
    blobSha?: string,
  ): Promise<FileContent> {
    try {
      const data = await this.request(
        `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${ref}`,
      )
      const content = Buffer.from(data.content, 'base64').toString('utf-8')
      return { content, sha: data.sha, size: data.size, encoding: 'utf-8' }
    } catch (err) {
      const message = (err as Error).message ?? ''
      if (message.includes('too large') || message.includes('403')) {
        if (!blobSha) throw err
        return this.getBlob(owner, repo, blobSha)
      }
      throw err
    }
  }

  async compareCommits(
    owner: string,
    repo: string,
    base: string,
    head: string,
  ): Promise<DiffEntry[]> {
    const data = await this.request(
      `/repos/${owner}/${repo}/compare/${base}...${head}`,
    )
    return (data.files ?? []).map(
      (f: { filename: string; status: string; previous_filename?: string; sha: string }) => {
        let status = f.status as DiffEntry['status']
        if (status !== 'added' && status !== 'modified' && status !== 'removed' && status !== 'renamed') {
          status = 'modified'
        }
        return {
          filename: f.filename,
          status,
          previousFilename: f.previous_filename,
          sha: f.sha,
        }
      },
    )
  }

  private async getBlob(owner: string, repo: string, sha: string): Promise<FileContent> {
    const data = await this.request(`/repos/${owner}/${repo}/git/blobs/${sha}`)
    const content = Buffer.from(data.content, 'base64').toString('utf-8')
    return { content, sha: data.sha, size: data.size, encoding: 'utf-8' }
  }

  private async request(path: string): Promise<Record<string, unknown>> {
    const headers = await this.auth.getHeaders()
    const response = await fetch(`${this.baseUrl}${path}`, { headers })

    await this.checkRateLimit(response)

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      if (response.status === 404) {
        throw new Error(
          `Repository not found or not accessible with current credentials (${path})`,
        )
      }
      if (response.status === 403 && body.includes('too large')) {
        throw new Error(`File too large for Contents API: ${body} (403)`)
      }
      throw new Error(`GitHub API error ${response.status}: ${body}`)
    }

    return response.json() as Promise<Record<string, unknown>>
  }

  private async checkRateLimit(response: Response): Promise<void> {
    const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') ?? '999', 10)
    const reset = parseInt(response.headers.get('X-RateLimit-Reset') ?? '0', 10)

    if (remaining < RATE_LIMIT_THRESHOLD && reset > 0) {
      const waitMs = Math.max(0, reset * 1000 - Date.now())
      if (waitMs > 0) {
        console.warn(`GitHub rate limit low (${remaining} remaining). Waiting ${Math.ceil(waitMs / 1000)}s.`)
        await new Promise((resolve) => setTimeout(resolve, waitMs))
      }
    }
  }
}
