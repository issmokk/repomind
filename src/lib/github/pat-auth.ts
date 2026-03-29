import type { GitHubAuthProvider } from './types'

export class PersonalAccessTokenAuth implements GitHubAuthProvider {
  async getHeaders(): Promise<Record<string, string>> {
    const token = process.env.GITHUB_PAT
    if (!token) {
      throw new Error(
        'GITHUB_PAT environment variable is not set. Set it to a GitHub Personal Access Token.',
      )
    }
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
  }
}
