import type { SupabaseClient } from '@supabase/supabase-js'
import type { StorageProvider } from '@/lib/storage/types'
import type { EmbeddingProvider } from '@/lib/indexer/embedding/types'
import type {
  RagConfig,
  RetrievalResult,
  HybridSearchResult,
  SourceReference,
  GraphContextEntry,
} from './types'

function computeConfidence(
  chunks: HybridSearchResult[]
): 'high' | 'medium' | 'low' {
  if (chunks.length === 0) return 'low'
  if (chunks.length < 3) return 'low'

  const bestScore = chunks[0]?.rrfScore ?? 0

  if (bestScore > 0.025 && chunks.length >= 5) return 'high'
  if (bestScore >= 0.015) return 'medium'
  return 'low'
}

function buildSourceReferences(
  chunks: HybridSearchResult[],
  repoNameMap: Map<string, string>
): SourceReference[] {
  return chunks.map((chunk) => ({
    filePath: chunk.filePath,
    lineStart: chunk.startLine,
    lineEnd: chunk.endLine,
    repoId: chunk.repoId,
    repoName: repoNameMap.get(chunk.repoId) ?? 'unknown',
    relevanceScore: chunk.rrfScore,
    symbolName: chunk.symbolName ?? undefined,
    symbolType: chunk.symbolType ?? undefined,
    chunkContent: chunk.content.slice(0, 200),
  }))
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export async function retrieveContext(
  query: string,
  repoIds: string[],
  config: RagConfig,
  storage: StorageProvider,
  embeddingProvider: EmbeddingProvider,
  userClient: SupabaseClient
): Promise<RetrievalResult> {
  let embedding: number[]
  try {
    embedding = await embeddingProvider.embedSingle(query)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Failed to embed query: ${msg}. Ensure your embedding provider is running.`
    )
  }

  if (embedding.length !== embeddingProvider.dimensions) {
    throw new Error(
      `Embedding dimension mismatch: expected ${embeddingProvider.dimensions}, got ${embedding.length}. The query embedding model must match the indexing model.`
    )
  }

  const userRepos = await storage.getRepositories(userClient)
  const userRepoIds = new Set(userRepos.map((r) => r.id))
  const repoNameMap = new Map(userRepos.map((r) => [r.id, r.name]))

  for (const repoId of repoIds) {
    if (!userRepoIds.has(repoId)) {
      throw new Error(`Repository ${repoId} not found or not accessible`)
    }
  }

  const chunks = await storage.hybridSearchChunks(
    embedding,
    query,
    repoIds,
    config.orgId,
    { topK: config.searchTopK, rrfK: config.searchRrfK }
  )

  let rankedChunks = chunks

  if (config.cohereApiKey) {
    try {
      const { rerank } = await import('ai')
      const { cohere } = await import('@ai-sdk/cohere')
      const reranked = await rerank({
        model: cohere.reranker('rerank-v3.5', {
          apiKey: config.cohereApiKey,
        }),
        query,
        documents: chunks.map(
          (c) => c.contextualizedContent ?? c.content
        ),
        topN: config.searchTopK,
      })
      rankedChunks = reranked.results.map((r) => chunks[r.index])
    } catch (err) {
      console.warn('Cohere reranking failed, falling back to RRF order:', err instanceof Error ? err.message : err)
    }
  }

  let graphContext: GraphContextEntry[] = []
  if (config.maxGraphHops > 0 && rankedChunks.length > 0) {
    const sourcesPerRepo = new Map<
      string,
      Array<{ filePath: string; symbolName: string }>
    >()

    for (const chunk of rankedChunks) {
      if (chunk.symbolName) {
        const existing = sourcesPerRepo.get(chunk.repoId) ?? []
        existing.push({
          filePath: chunk.filePath,
          symbolName: chunk.symbolName,
        })
        sourcesPerRepo.set(chunk.repoId, existing)
      }
    }

    const graphResults = await Promise.all(
      Array.from(sourcesPerRepo.entries()).map(([repoId, sources]) =>
        storage.getRelatedEdgesBatch(repoId, sources, { depth: config.maxGraphHops })
      )
    )
    for (const edgeGroups of graphResults) {
      for (const group of edgeGroups) {
        for (const edge of group.edges) {
          graphContext.push({
            edge,
            hop: group.hop,
            sourceSymbol: `${group.source.filePath}:${group.source.symbolName}`,
          })
        }
      }
    }
  }

  const tokenBudget = config.tokenBudget ?? 8000
  let usedTokens = 0
  const assembledChunks: HybridSearchResult[] = []

  for (const chunk of rankedChunks) {
    const tokens = estimateTokens(chunk.contextualizedContent ?? chunk.content)
    if (assembledChunks.length === 0 || usedTokens + tokens <= tokenBudget) {
      assembledChunks.push(chunk)
      usedTokens += tokens
    }
  }

  const assembledGraph: GraphContextEntry[] = []
  const hop1 = graphContext.filter((g) => g.hop === 1)
  const hop2Plus = graphContext.filter((g) => g.hop >= 2)

  for (const entry of [...hop1, ...hop2Plus]) {
    const tokens = estimateTokens(entry.chunkContent ?? '')
    if (usedTokens + tokens <= tokenBudget) {
      assembledGraph.push(entry)
      usedTokens += tokens
    }
  }

  const confidence = computeConfidence(chunks)

  return {
    chunks: assembledChunks,
    graphContext: assembledGraph,
    totalCandidates: chunks.length,
    confidence,
    sources: buildSourceReferences(assembledChunks, repoNameMap),
  }
}
