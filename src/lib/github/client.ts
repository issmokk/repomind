import type { GitHubAuthProvider, RepoInfo, FileTreeEntry, DiffEntry, FileContent } from './types'

const RATE_LIMIT_THRESHOLD = 100

export class GitHubClient {
  constructor(
    private auth: GitHubAuthProvider,
    private baseUrl = 'https://api.github.com',
  ) { }

  async getRepoMetadata(owner: string, repo: string): Promise<RepoInfo> {
    const data = await this.request<{
      name: string
      full_name: string
      default_branch: string
      html_url: string
      private: boolean
    }>(`/repos/${owner}/${repo}`)
    return {
      name: data.name,
      fullName: data.full_name,
      defaultBranch: data.default_branch,
      url: data.html_url,
      private: data.private,
    }
  }

  async getBranchHeadSha(owner: string, repo: string, branch: string): Promise<string> {
    const data = await this.request<{ object: { sha: string } }>(
      `/repos/${owner}/${repo}/git/ref/heads/${branch}`,
    )
    return data.object.sha
  }

  async getFileTree(owner: string, repo: string, sha: string): Promise<FileTreeEntry[]> {
    const data = await this.request<{
      truncated: boolean
      tree: Array<{ path: string; sha: string; size?: number; type: string }>
    }>(`/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`)
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
    if (blobSha) {
      return this.getBlob(owner, repo, blobSha)
    }
    const data = await this.request<{ content: string; sha: string; size: number }>(
      `/repos/${owner}/${repo}/contents/${path}?ref=${ref}`,
    )
    const content = Buffer.from(data.content, 'base64').toString('utf-8')
    return { content, sha: data.sha, size: data.size, encoding: 'utf-8' }
  }

  async getCommitsBehind(
    owner: string,
    repo: string,
    base: string,
    head: string,
  ): Promise<{ behind: number; headSha: string }> {
    const data = await this.request<{
      ahead_by: number
      commits: Array<{ sha: string }>
    }>(`/repos/${owner}/${repo}/compare/${base}...${head}`)
    return {
      behind: data.ahead_by,
      headSha: data.commits.length > 0 ? data.commits[data.commits.length - 1].sha : base,
    }
  }

  async compareCommits(
    owner: string,
    repo: string,
    base: string,
    head: string,
  ): Promise<DiffEntry[]> {
    const data = await this.request<{
      files?: Array<{ filename: string; status: string; previous_filename?: string; sha: string }>
    }>(`/repos/${owner}/${repo}/compare/${base}...${head}`)
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
    const data = await this.request<{ content: string; sha: string; size: number }>(`/repos/${owner}/${repo}/git/blobs/${sha}`)
    const content = Buffer.from(data.content, 'base64').toString('utf-8')
    return { content, sha: data.sha, size: data.size, encoding: 'utf-8' }
  }

  private async request<T = unknown>(path: string): Promise<T> {
    const headers = await this.auth.getHeaders()
    const url = `${this.baseUrl}${path}`

    let response: Response
    try {
      response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(30_000),
      })
    } catch (err) {
      const cause = (err as Error).cause
      const causeMsg = cause instanceof Error ? `: ${cause.message}` : ''
      throw new Error(`Network error fetching ${path}${causeMsg}`)
    }

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

    const data = await response.json()
    return data as T
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
