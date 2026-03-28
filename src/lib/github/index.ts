export type { GitHubAuthProvider, GitHubAppAuthProvider, RepoInfo, FileTreeEntry, DiffEntry, FileContent } from './types'
export { PersonalAccessTokenAuth } from './pat-auth'
export { GitHubClient } from './client'
export { GitHubFileCache } from './cache'

import type { GitHubAuthProvider } from './types'
import { PersonalAccessTokenAuth } from './pat-auth'

export function createGitHubAuth(type: 'pat' | 'github_app'): GitHubAuthProvider {
  switch (type) {
    case 'pat':
      return new PersonalAccessTokenAuth()
    case 'github_app':
      throw new Error('GitHub App auth is not yet implemented')
    default:
      throw new Error(`Unknown GitHub auth type: "${type}"`)
  }
}
