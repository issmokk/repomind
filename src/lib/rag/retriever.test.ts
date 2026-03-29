// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { retrieveContext } from './retriever'
import type { RagConfig, HybridSearchResult } from './types'

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return { ...actual, rerank: vi.fn() }
})

function createMockStorage() {
  return {
    hybridSearchChunks: vi.fn().mockResolvedValue([]),
    getRelatedEdgesBatch: vi.fn().mockResolvedValue([]),
    getRepositories: vi.fn().mockResolvedValue([
      { id: 'repo-1', orgId: 'org-1', name: 'test-repo', fullName: 'org/test-repo' },
      { id: 'repo-2', orgId: 'org-1', name: 'other-repo', fullName: 'org/other-repo' },
    ]),
  }
}

function createMockEmbedding() {
  return {
    name: 'ollama/test-model',
    dimensions: 1536,
    embedSingle: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
    embed: vi.fn(),
    validateDimensions: vi.fn(),
  }
}

const baseConfig: RagConfig = {
  searchTopK: 10,
  searchRrfK: 60,
  maxGraphHops: 2,
  cohereApiKey: null,
  tokenBudget: 8000,
  orgId: 'org-1',
  embeddingProvider: 'ollama',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'gte-qwen2-1.5b-instruct',
  openaiModel: 'text-embedding-3-small',
  providerOrder: ['ollama'],
  claudeApiKey: null,
  claudeModel: 'claude-sonnet-4.6',
  openaiApiKey: null,
  openaiLlmModel: 'gpt-4o',
}

function makeChunk(overrides: Partial<HybridSearchResult> = {}): HybridSearchResult {
  return {
    id: 1,
    repoId: 'repo-1',
    filePath: 'src/test.ts',
    chunkIndex: 0,
    content: 'function test() { return true }',
    contextualizedContent: 'File: src/test.ts\nfunction test() { return true }',
    language: 'typescript',
    symbolName: 'test',
    symbolType: 'function',
    startLine: 1,
    endLine: 5,
    parentScope: null,
    rrfScore: 0.03,
    vectorRank: 1,
    ftsRank: 1,
    vectorSimilarity: 0.9,
    ...overrides,
  }
}

const mockUserClient = {} as never

describe('retrieveContext', () => {
  let mockStorage: ReturnType<typeof createMockStorage>
  let mockEmbedding: ReturnType<typeof createMockEmbedding>

  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage = createMockStorage()
    mockEmbedding = createMockEmbedding()
  })

  it('embeds query using provided embedding provider', async () => {
    await retrieveContext('what does test do', ['repo-1'], baseConfig, mockStorage as never, mockEmbedding as never, mockUserClient)
    expect(mockEmbedding.embedSingle).toHaveBeenCalledWith('what does test do')
  })

  it('validates query embedding dimension matches provider dimensions', async () => {
    mockEmbedding.embedSingle.mockResolvedValue(new Array(768).fill(0.1))
    await expect(
      retrieveContext('test', ['repo-1'], baseConfig, mockStorage as never, mockEmbedding as never, mockUserClient)
    ).rejects.toThrow('Embedding dimension mismatch')
  })

  it('validates repoIds belong to user org', async () => {
    await expect(
      retrieveContext('test', ['repo-999'], baseConfig, mockStorage as never, mockEmbedding as never, mockUserClient)
    ).rejects.toThrow('not found or not accessible')
  })

  it('calls hybridSearchChunks with correct parameters', async () => {
    await retrieveContext('what does test do', ['repo-1'], baseConfig, mockStorage as never, mockEmbedding as never, mockUserClient)
    expect(mockStorage.hybridSearchChunks).toHaveBeenCalledWith(
      expect.any(Array),
      'what does test do',
      ['repo-1'],
      'org-1',
      { topK: 10, rrfK: 60 }
    )
  })

  it('skips rerank when cohereApiKey is not configured', async () => {
    const { rerank } = await import('ai')
    mockStorage.hybridSearchChunks.mockResolvedValue([makeChunk()])
    await retrieveContext('test', ['repo-1'], baseConfig, mockStorage as never, mockEmbedding as never, mockUserClient)
    expect(rerank).not.toHaveBeenCalled()
  })

  it('calls getRelatedEdgesBatch with symbols from top-K chunks', async () => {
    const chunk = makeChunk({ symbolName: 'parseConfig', filePath: 'src/config.ts' })
    mockStorage.hybridSearchChunks.mockResolvedValue([chunk])
    await retrieveContext('test', ['repo-1'], baseConfig, mockStorage as never, mockEmbedding as never, mockUserClient)
    expect(mockStorage.getRelatedEdgesBatch).toHaveBeenCalledWith(
      'repo-1',
      [{ filePath: 'src/config.ts', symbolName: 'parseConfig' }],
      { depth: 2 }
    )
  })

  it('respects maxGraphHops from config', async () => {
    const chunk = makeChunk({ symbolName: 'foo' })
    mockStorage.hybridSearchChunks.mockResolvedValue([chunk])
    const config = { ...baseConfig, maxGraphHops: 1 }
    await retrieveContext('test', ['repo-1'], config, mockStorage as never, mockEmbedding as never, mockUserClient)
    expect(mockStorage.getRelatedEdgesBatch).toHaveBeenCalledWith(
      'repo-1',
      expect.any(Array),
      { depth: 1 }
    )
  })

  it('computes confidence "high" when best RRF score > 0.025 and >= 5 results', async () => {
    const chunks = Array.from({ length: 5 }, (_, i) => makeChunk({ id: i, rrfScore: 0.03 - i * 0.001 }))
    mockStorage.hybridSearchChunks.mockResolvedValue(chunks)
    const result = await retrieveContext('test', ['repo-1'], baseConfig, mockStorage as never, mockEmbedding as never, mockUserClient)
    expect(result.confidence).toBe('high')
  })

  it('computes confidence "medium" when best RRF score between 0.015 and 0.025', async () => {
    const chunks = Array.from({ length: 5 }, (_, i) => makeChunk({ id: i, rrfScore: 0.02 }))
    mockStorage.hybridSearchChunks.mockResolvedValue(chunks)
    const result = await retrieveContext('test', ['repo-1'], baseConfig, mockStorage as never, mockEmbedding as never, mockUserClient)
    expect(result.confidence).toBe('medium')
  })

  it('computes confidence "low" when fewer than 3 results', async () => {
    mockStorage.hybridSearchChunks.mockResolvedValue([makeChunk()])
    const result = await retrieveContext('test', ['repo-1'], baseConfig, mockStorage as never, mockEmbedding as never, mockUserClient)
    expect(result.confidence).toBe('low')
  })

  it('handles empty search results gracefully', async () => {
    const result = await retrieveContext('test', ['repo-1'], baseConfig, mockStorage as never, mockEmbedding as never, mockUserClient)
    expect(result.confidence).toBe('low')
    expect(result.chunks).toHaveLength(0)
    expect(result.sources).toHaveLength(0)
  })

  it('handles embedding provider errors with descriptive message', async () => {
    mockEmbedding.embedSingle.mockRejectedValue(new Error('connect ECONNREFUSED'))
    await expect(
      retrieveContext('test', ['repo-1'], baseConfig, mockStorage as never, mockEmbedding as never, mockUserClient)
    ).rejects.toThrow('Failed to embed query')
  })

  it('builds source references from chunks', async () => {
    const chunk = makeChunk({ filePath: 'src/config.ts', startLine: 10, endLine: 20, rrfScore: 0.05 })
    mockStorage.hybridSearchChunks.mockResolvedValue([chunk])
    const result = await retrieveContext('test', ['repo-1'], baseConfig, mockStorage as never, mockEmbedding as never, mockUserClient)
    expect(result.sources).toHaveLength(1)
    expect(result.sources[0].filePath).toBe('src/config.ts')
    expect(result.sources[0].lineStart).toBe(10)
    expect(result.sources[0].lineEnd).toBe(20)
    expect(result.sources[0].repoName).toBe('test-repo')
  })
})
