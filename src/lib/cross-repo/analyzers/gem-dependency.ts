import type { CrossRepoAnalyzer, CrossRepoEdge } from '../types'
import type { Repository } from '@/types/repository'
import type { StorageProvider } from '@/lib/storage/types'
import type { GitHubClient } from '@/lib/github/client'

const GEM_LINE_REGEX = /^\s*gem\s+['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]+)['"])?(?:.*path:\s*['"]([^'"]+)['"])?/

type GemEntry = {
  repoId: string
  versionConstraint: string | null
  isLocal: boolean
  localPath: string | null
}

export class GemDependencyAnalyzer implements CrossRepoAnalyzer {
  readonly name = 'gem-dependency'

  constructor(private gemPrefixes: string[] = ['wt_']) {}

  async analyze(
    repos: Repository[],
    storage: StorageProvider,
    githubClient: GitHubClient,
  ): Promise<CrossRepoEdge[]> {
    const gemMap = new Map<string, GemEntry[]>()

    for (const repo of repos) {
      const content = await this.readGemfile(repo, storage, githubClient)
      if (!content) continue

      const gems = this.parseGemfile(content)
      for (const gem of gems) {
        const entries = gemMap.get(gem.name) ?? []
        entries.push({
          repoId: repo.id,
          versionConstraint: gem.versionConstraint,
          isLocal: gem.isLocal,
          localPath: gem.localPath,
        })
        gemMap.set(gem.name, entries)
      }
    }

    return this.buildEdges(gemMap)
  }

  private async readGemfile(
    repo: Repository,
    storage: StorageProvider,
    githubClient: GitHubClient,
  ): Promise<string | null> {
    const cached = await storage.getCachedFile(repo.id, 'Gemfile')
    if (cached) return cached.content

    try {
      const [owner, repoName] = repo.fullName.split('/')
      const file = await githubClient.getFileContent(owner, repoName, 'Gemfile', repo.defaultBranch)
      return file.content
    } catch {
      return null
    }
  }

  private parseGemfile(content: string) {
    const gems: Array<{ name: string; versionConstraint: string | null; isLocal: boolean; localPath: string | null }> = []

    for (const line of content.split('\n')) {
      const match = line.match(GEM_LINE_REGEX)
      if (!match) continue

      gems.push({
        name: match[1],
        versionConstraint: match[2] ?? null,
        isLocal: !!match[3],
        localPath: match[3] ?? null,
      })
    }

    return gems
  }

  private buildEdges(gemMap: Map<string, GemEntry[]>): CrossRepoEdge[] {
    const edges: CrossRepoEdge[] = []

    for (const [gemName, entries] of gemMap) {
      const isRelevantPrefix = this.gemPrefixes.some(prefix => gemName.startsWith(prefix))
      const hasLocalEntry = entries.some(e => e.isLocal)
      const sharedAcrossRepos = entries.length >= 2

      if (!isRelevantPrefix && !hasLocalEntry && !sharedAcrossRepos) continue

      if (sharedAcrossRepos) {
        for (let i = 0; i < entries.length; i++) {
          for (let j = 0; j < entries.length; j++) {
            if (i === j) continue
            edges.push(this.makeEdge(gemName, entries[i], entries[j].repoId))
          }
        }
      } else {
        for (const entry of entries) {
          if (entry.isLocal) {
            edges.push(this.makeEdge(gemName, entry, entry.repoId))
          }
        }
      }
    }

    return edges
  }

  private makeEdge(gemName: string, entry: GemEntry, targetRepoId: string): CrossRepoEdge {
    return {
      sourceRepoId: entry.repoId,
      sourceFile: 'Gemfile',
      sourceSymbol: gemName,
      targetRepoId,
      targetFile: null,
      targetSymbol: gemName,
      relationshipType: 'gem_dependency',
      metadata: {
        version_constraint: entry.versionConstraint,
        is_local_gem: entry.isLocal,
        ...(entry.localPath && { local_path: entry.localPath }),
      },
      confidence: 1.0,
    }
  }
}
