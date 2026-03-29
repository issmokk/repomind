import type { GraphEdge } from '@/types/graph'

export type QueryRequest = {
  question: string
  repoIds: string[]
  filters?: {
    language?: string
    filePathPattern?: string
    recency?: string
  }
  sessionId?: string
}

export type QueryResponse = {
  answer: string
  sources: SourceReference[]
  confidence: 'high' | 'medium' | 'low'
  modelUsed: string
  providerUsed: string
  retrievalLatencyMs: number
  generationLatencyMs: number
}

export type SourceReference = {
  filePath: string
  lineStart: number
  lineEnd: number
  repoId: string
  repoName: string
  relevanceScore: number
  symbolName?: string
  symbolType?: string
  chunkContent: string
}

export type HybridSearchResult = {
  id: number
  repoId: string
  filePath: string
  chunkIndex: number
  content: string
  contextualizedContent: string
  language: string | null
  symbolName: string | null
  symbolType: string | null
  startLine: number
  endLine: number
  parentScope: string | null
  rrfScore: number
  vectorRank: number | null
  ftsRank: number | null
  vectorSimilarity: number | null
}

export type GraphContextEntry = {
  edge: GraphEdge
  hop: number
  sourceSymbol: string
  chunkContent?: string
}

export type RetrievalResult = {
  chunks: HybridSearchResult[]
  graphContext: GraphContextEntry[]
  totalCandidates: number
  confidence: 'high' | 'medium' | 'low'
  sources: SourceReference[]
}

export type ContextWindow = {
  systemPrompt: string
  contextChunks: string
  graphContext: string
  userQuery: string
  estimatedTokens: number
}

export type RagConfig = {
  embeddingProvider: string
  ollamaBaseUrl: string
  ollamaModel: string
  openaiModel: string
  providerOrder: string[]
  claudeApiKey: string | null
  claudeModel: string
  openaiApiKey: string | null
  openaiLlmModel: string
  cohereApiKey: string | null
  maxGraphHops: number
  searchTopK: number
  searchRrfK: number
  orgId: string
  tokenBudget?: number
}

export type PromptTemplate = {
  language: string
  systemPrompt: string
  contextFormat: string
}

export type QueryAnalysis = {
  queryType: 'factual' | 'architectural' | 'debugging' | 'explanation'
  suggestedGraphDepth: number
  searchEmphasis: 'semantic' | 'keyword' | 'balanced'
  detectedLanguage: string | null
}

export type ChatMessage = {
  id: string
  orgId: string
  userId: string
  sessionId: string | null
  repoIds: string[]
  question: string
  answer: string | null
  sources: SourceReference[]
  confidence: 'high' | 'medium' | 'low' | null
  modelUsed: string | null
  providerUsed: string | null
  retrievalLatencyMs: number | null
  generationLatencyMs: number | null
  createdAt: string
}

export type NewChatMessage = Omit<ChatMessage, 'id' | 'createdAt'>

export type QueryFeedback = {
  id: string
  messageId: string
  userId: string
  rating: 'up' | 'down'
  comment: string | null
  createdAt: string
}

export type NewQueryFeedback = Omit<QueryFeedback, 'id' | 'createdAt'>
