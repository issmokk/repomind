import type { CrossRepoAnalyzer, CrossRepoEdge } from './types'
import type { Repository } from '@/types/repository'
import type { StorageProvider } from '@/lib/storage/types'
import type { GitHubClient } from '@/lib/github/client'

export class AnalyzerRegistry {
  private analyzers: Map<string, CrossRepoAnalyzer> = new Map()

  register(analyzer: CrossRepoAnalyzer): void {
    this.analyzers.set(analyzer.name, analyzer)
  }

  getAll(): CrossRepoAnalyzer[] {
    return Array.from(this.analyzers.values())
  }

  async runAll(
    repos: Repository[],
    storage: StorageProvider,
    githubClient: GitHubClient
  ): Promise<CrossRepoEdge[]> {
    const results: CrossRepoEdge[] = []

    for (const analyzer of this.analyzers.values()) {
      try {
        const edges = await analyzer.analyze(repos, storage, githubClient)
        results.push(...edges)
      } catch (err) {
        console.error(`Analyzer "${analyzer.name}" failed:`, err)
      }
    }

    return results
  }
}

export const defaultRegistry = new AnalyzerRegistry()
