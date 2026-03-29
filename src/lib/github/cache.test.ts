// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GitHubFileCache } from './cache'

vi.mock('@/lib/indexer/languages', () => ({
  SUPPORTED_LANGUAGES: [
    { name: 'typescript', extensions: ['.ts', '.tsx'], grammarFile: 'tree-sitter-typescript.wasm' },
    { name: 'ruby', extensions: ['.rb'], grammarFile: 'tree-sitter-ruby.wasm' },
  ],
}))

describe('GitHubFileCache', () => {
  let cache: GitHubFileCache
  let mockStorage: Record<string, ReturnType<typeof vi.fn>>
  let mockClient: Record<string, ReturnType<typeof vi.fn>>

  beforeEach(() => {
    mockStorage = {
      getCachedFile: vi.fn(),
      setCachedFile: vi.fn(),
      bulkInvalidateCache: vi.fn(),
    }
    mockClient = {
      getFileContent: vi.fn(),
    }
    cache = new GitHubFileCache(mockClient as never, mockStorage as never)
  })

  it('returns cached content when SHA matches', async () => {
    mockStorage.getCachedFile.mockResolvedValue({
      content: 'cached code',
      sha: 'abc123',
      sizeBytes: 100,
    })

    const result = await cache.fetchOrCacheFile('repo-1', 'owner', 'repo', 'src/index.ts', 'main', 'abc123')
    expect(result.content).toBe('cached code')
    expect(mockClient.getFileContent).not.toHaveBeenCalled()
  })

  it('fetches from GitHub when cache miss', async () => {
    mockStorage.getCachedFile.mockResolvedValue(null)
    mockClient.getFileContent.mockResolvedValue({
      content: 'fresh code',
      sha: 'new-sha',
      size: 50,
      encoding: 'utf-8',
    })

    const result = await cache.fetchOrCacheFile('repo-1', 'owner', 'repo', 'src/index.ts', 'main', 'new-sha')
    expect(result.content).toBe('fresh code')
    expect(mockClient.getFileContent).toHaveBeenCalledWith('owner', 'repo', 'src/index.ts', 'main', undefined)
    expect(mockStorage.setCachedFile).toHaveBeenCalledWith('repo-1', expect.objectContaining({
      filePath: 'src/index.ts',
      sha: 'new-sha',
      language: 'typescript',
    }))
  })

  it('fetches from GitHub when SHA differs (stale cache)', async () => {
    mockStorage.getCachedFile.mockResolvedValue({
      content: 'old code',
      sha: 'old-sha',
      sizeBytes: 80,
    })
    mockClient.getFileContent.mockResolvedValue({
      content: 'updated code',
      sha: 'new-sha',
      size: 90,
      encoding: 'utf-8',
    })

    const result = await cache.fetchOrCacheFile('repo-1', 'owner', 'repo', 'src/index.ts', 'main', 'new-sha')
    expect(result.content).toBe('updated code')
    expect(mockClient.getFileContent).toHaveBeenCalled()
  })

  it('clearCacheForRepo delegates to storage', async () => {
    await cache.clearCacheForRepo('repo-1')
    expect(mockStorage.bulkInvalidateCache).toHaveBeenCalledWith('repo-1')
  })
})
