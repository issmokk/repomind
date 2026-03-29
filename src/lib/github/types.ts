export interface GitHubAuthProvider {
  getHeaders(): Promise<Record<string, string>>
}

export interface GitHubAppAuthProvider extends GitHubAuthProvider {
  getInstallationRepos(): Promise<RepoInfo[]>
}

export interface RepoInfo {
  name: string
  fullName: string
  defaultBranch: string
  url: string
  private: boolean
}

export interface FileTreeEntry {
  path: string
  sha: string
  size: number
  type: 'blob' | 'tree'
}

export interface DiffEntry {
  filename: string
  status: 'added' | 'modified' | 'removed' | 'renamed'
  previousFilename?: string
  sha: string
}

export interface FileContent {
  content: string
  sha: string
  size: number
  encoding: string
}
