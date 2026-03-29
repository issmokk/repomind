import type { StorageProvider } from '@/lib/storage/types'
import type { GitHubClient } from './client'
import type { FileContent } from './types'
import { SUPPORTED_LANGUAGES } from '@/lib/indexer/languages'

function detectLanguage(filePath: string): string | null {
  const ext = '.' + filePath.split('.').pop()
  for (const lang of SUPPORTED_LANGUAGES) {
    if ((lang.extensions as readonly string[]).includes(ext)) return lang.name
  }
  return null
}

export class GitHubFileCache {
  constructor(
    private githubClient: GitHubClient,
    private storage: StorageProvider,
  ) {}

  async fetchOrCacheFile(
    repoId: string,
    owner: string,
    repo: string,
    filePath: string,
    ref: string,
    currentSha: string,
    blobSha?: string,
  ): Promise<FileContent> {
    const cached = await this.storage.getCachedFile(repoId, filePath)
    if (cached && cached.sha === currentSha) {
      return {
        content: cached.content,
        sha: cached.sha,
        size: cached.sizeBytes ?? cached.content.length,
        encoding: 'utf-8',
      }
    }

    const fetched = await this.githubClient.getFileContent(owner, repo, filePath, ref, blobSha)

    await this.storage.setCachedFile(repoId, {
      repoId,
      filePath,
      content: fetched.content,
      sha: fetched.sha,
      language: detectLanguage(filePath),
      sizeBytes: fetched.size,
      isGenerated: false,
    })

    return fetched
  }

  async clearCacheForRepo(repoId: string): Promise<void> {
    await this.storage.bulkInvalidateCache(repoId)
  }
}
