export type EmbeddingProviderName = 'ollama' | 'openai'

export type EmbeddingConfig = {
  provider: EmbeddingProviderName
  model: string
  dimensions: number
}
