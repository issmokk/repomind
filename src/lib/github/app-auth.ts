import { createAppAuth } from '@octokit/auth-app'
import type { GitHubAppAuthProvider, RepoInfo } from './types'

export class GitHubAppAuth implements GitHubAppAuthProvider {
  private auth: ReturnType<typeof createAppAuth>
  private installationId: number

  constructor(installationId: number) {
    const appId = process.env.GITHUB_APP_ID
    if (!appId) {
      throw new Error('GITHUB_APP_ID environment variable is not set')
    }

    const encodedKey = process.env.GITHUB_APP_PRIVATE_KEY
    if (!encodedKey) {
      throw new Error('GITHUB_APP_PRIVATE_KEY environment variable is not set')
    }

    const privateKey = Buffer.from(encodedKey, 'base64').toString('utf-8')
    this.installationId = installationId

    this.auth = createAppAuth({
      appId,
      privateKey,
      installationId,
    })
  }

  async getHeaders(): Promise<Record<string, string>> {
    const { token } = await this.auth({ type: 'installation' })
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
  }

  async getInstallationRepos(): Promise<RepoInfo[]> {
    const headers = await this.getHeaders()
    const response = await fetch('https://api.github.com/installation/repositories', { headers })

    if (!response.ok) {
      throw new Error(`Failed to fetch installation repos: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as { repositories: Array<{
      name: string
      full_name: string
      default_branch: string
      html_url: string
      private: boolean
    }> }

    return data.repositories.map((repo) => ({
      name: repo.name,
      fullName: repo.full_name,
      defaultBranch: repo.default_branch,
      url: repo.html_url,
      private: repo.private,
    }))
  }
}
