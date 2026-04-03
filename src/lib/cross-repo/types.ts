import type { Repository } from '@/types/repository'
import type { StorageProvider } from '@/lib/storage/types'
import type { GitHubClient } from '@/lib/github/client'
import type { CrossRepoRelationshipType } from '@/types/cross-repo'

export interface CrossRepoEdge {
  sourceRepoId: string
  sourceFile: string
  sourceSymbol: string
  targetRepoId: string
  targetFile: string | null
  targetSymbol: string
  relationshipType: CrossRepoRelationshipType
  metadata: Record<string, unknown>
  confidence: number
}

export interface CrossRepoAnalyzer {
  name: string
  analyze(
    repos: Repository[],
    storage: StorageProvider,
    githubClient: GitHubClient
  ): Promise<CrossRepoEdge[]>
}
