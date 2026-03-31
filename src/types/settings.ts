export type EmbeddingProvider = 'ollama' | 'openai' | 'gemini'

export type TeamSettings = {
  id: string
  orgId: string
  teamId: string
  embeddingProvider: EmbeddingProvider
  ollamaBaseUrl: string
  ollamaModel: string
  ollamaLlmModel: string
  openaiModel: string
  providerOrder: string[]
  claudeApiKey: string | null
  claudeModel: string
  openaiApiKey: string | null
  openaiLlmModel: string
  cohereApiKey: string | null
  geminiApiKey: string | null
  geminiModel: string
  geminiEmbeddingModel: string
  maxGraphHops: number
  searchTopK: number
  searchRrfK: number
  createdAt: string
  updatedAt: string
}

export type TeamSettingsUpdate = Partial<
  Omit<TeamSettings, 'id' | 'orgId' | 'teamId' | 'createdAt' | 'updatedAt'>
>
