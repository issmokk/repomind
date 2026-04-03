import type { CrossRepoAnalyzer, CrossRepoEdge } from '../types'
import type { Repository } from '@/types/repository'
import type { StorageProvider } from '@/lib/storage/types'
import type { GitHubClient } from '@/lib/github/client'

const IGNORE_LIST = new Set([
  'react', 'react-dom', 'typescript', 'vitest', 'jest', 'eslint',
  'prettier', 'lodash', 'axios', 'next', 'tailwindcss',
])

const IGNORE_PREFIXES = ['@types/']

type PackageEntry = {
  repoId: string
  version: string
  isDev: boolean
}

export class NpmDependencyAnalyzer implements CrossRepoAnalyzer {
  readonly name = 'npm-dependency'

  constructor(private scopePrefixes: string[] = ['@wetravel-mfe/', '@wetravel/']) {}

  async analyze(
    repos: Repository[],
    storage: StorageProvider,
    githubClient: GitHubClient,
  ): Promise<CrossRepoEdge[]> {
    const pkgMap = new Map<string, PackageEntry[]>()

    for (const repo of repos) {
      const content = await this.readPackageJson(repo, storage, githubClient)
      if (!content) continue

      let parsed: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
      try {
        parsed = JSON.parse(content)
      } catch {
        continue
      }

      this.collectDeps(repo.id, parsed.dependencies, false, pkgMap)
      this.collectDeps(repo.id, parsed.devDependencies, true, pkgMap)
    }

    return this.buildEdges(pkgMap)
  }

  private async readPackageJson(
    repo: Repository,
    storage: StorageProvider,
    githubClient: GitHubClient,
  ): Promise<string | null> {
    const cached = await storage.getCachedFile(repo.id, 'package.json')
    if (cached) return cached.content

    try {
      const [owner, repoName] = repo.fullName.split('/')
      const file = await githubClient.getFileContent(owner, repoName, 'package.json', repo.defaultBranch)
      return file.content
    } catch {
      return null
    }
  }

  private collectDeps(
    repoId: string,
    deps: Record<string, string> | undefined,
    isDev: boolean,
    pkgMap: Map<string, PackageEntry[]>,
  ) {
    if (!deps) return

    for (const [name, version] of Object.entries(deps)) {
      if (IGNORE_LIST.has(name)) continue
      if (IGNORE_PREFIXES.some(prefix => name.startsWith(prefix))) continue

      const entries = pkgMap.get(name) ?? []
      entries.push({ repoId, version, isDev })
      pkgMap.set(name, entries)
    }
  }

  private buildEdges(pkgMap: Map<string, PackageEntry[]>): CrossRepoEdge[] {
    const edges: CrossRepoEdge[] = []

    for (const [pkgName, entries] of pkgMap) {
      const isScoped = this.scopePrefixes.some(prefix => pkgName.startsWith(prefix))
      const sharedAcrossRepos = new Set(entries.map(e => e.repoId)).size >= 2

      if (!isScoped && !sharedAcrossRepos) continue

      if (sharedAcrossRepos) {
        for (let i = 0; i < entries.length; i++) {
          for (let j = 0; j < entries.length; j++) {
            if (i === j) continue
            edges.push(this.makeEdge(pkgName, entries[i], entries[j].repoId))
          }
        }
      } else if (isScoped) {
        for (const entry of entries) {
          edges.push(this.makeEdge(pkgName, entry, entry.repoId))
        }
      }
    }

    return edges
  }

  private makeEdge(pkgName: string, entry: PackageEntry, targetRepoId: string): CrossRepoEdge {
    return {
      sourceRepoId: entry.repoId,
      sourceFile: 'package.json',
      sourceSymbol: pkgName,
      targetRepoId,
      targetFile: null,
      targetSymbol: pkgName,
      relationshipType: 'npm_dependency',
      metadata: {
        version: entry.version,
        is_dev_dependency: entry.isDev,
      },
      confidence: 1.0,
    }
  }
}
