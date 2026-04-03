export type GitHubAuthType = 'pat' | 'github_app'

export type IndexingMethod = 'manual' | 'webhook' | 'git_diff' | 'cron'

export type Repository = {
  id: string
  orgId: string
  name: string
  fullName: string
  url: string
  defaultBranch: string
  lastIndexedCommit: string | null
  githubAuthType: GitHubAuthType
  githubAppInstallationId: number | null
  createdAt: string
  updatedAt: string
}

export type NewRepository = Omit<Repository, 'id' | 'createdAt' | 'updatedAt'>

export type RepositorySettings = {
  id: string
  repoId: string
  branchFilter: string[]
  includePatterns: string[]
  excludePatterns: string[]
  embeddingProvider: string
  embeddingModel: string
  indexingMethod: IndexingMethod
  autoIndexOnAdd: boolean
  createdAt: string
  updatedAt: string
}

export type RepositorySettingsUpdate = Partial<
  Omit<RepositorySettings, 'id' | 'repoId' | 'createdAt' | 'updatedAt'>
>

export type CachedFile = {
  id: number
  repoId: string
  filePath: string
  content: string
  sha: string
  language: string | null
  sizeBytes: number | null
  isGenerated: boolean
  fetchedAt: string
}

export type CachedFileUpsert = Omit<CachedFile, 'id' | 'fetchedAt'>
