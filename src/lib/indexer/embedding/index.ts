export type { EmbeddingProvider } from './types'
export { OllamaProvider } from './ollama'
export { OpenAIProvider } from './openai'
export { GeminiProvider } from './gemini'

import type { EmbeddingProvider } from './types'
import { OllamaProvider } from './ollama'
import { OpenAIProvider } from './openai'
import { GeminiProvider } from './gemini'

export type EmbeddingProviderConfig = {
  geminiApiKey?: string
  geminiEmbeddingModel?: string
  ollamaModel?: string
  ollamaBaseUrl?: string
  openaiModel?: string
}

export function createEmbeddingProvider(name: string, config?: EmbeddingProviderConfig): EmbeddingProvider {
  switch (name) {
    case 'gemini':
      return new GeminiProvider(
        config?.geminiApiKey ?? '',
        config?.geminiEmbeddingModel ?? undefined
      )
    case 'ollama':
      return new OllamaProvider(
        config?.ollamaModel ?? undefined,
        config?.ollamaBaseUrl ?? undefined
      )
    case 'openai':
      return new OpenAIProvider(config?.openaiModel ?? undefined)
    default:
      throw new Error(`Unknown embedding provider "${name}". Supported: ollama, openai, gemini`)
  }
}
