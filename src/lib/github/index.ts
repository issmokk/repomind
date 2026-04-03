export type { GitHubAuthProvider, GitHubAppAuthProvider, RepoInfo, FileTreeEntry, DiffEntry, FileContent } from './types'
export { PersonalAccessTokenAuth } from './pat-auth'
export { GitHubAppAuth } from './app-auth'
export { GitHubClient } from './client'
export { GitHubFileCache } from './cache'

import type { GitHubAuthProvider } from './types'
import { PersonalAccessTokenAuth } from './pat-auth'
import { GitHubAppAuth } from './app-auth'

export function createGitHubAuth(
  type: 'pat' | 'github_app',
  options?: { installationId?: number },
): GitHubAuthProvider {
  switch (type) {
    case 'pat':
      return new PersonalAccessTokenAuth()
    case 'github_app': {
      if (!options?.installationId) {
        throw new Error('installationId is required for GitHub App auth')
      }
      return new GitHubAppAuth(options.installationId)
    }
    default:
      throw new Error(`Unknown GitHub auth type: "${type}"`)
  }
}
