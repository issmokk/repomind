export type { EmbeddingProvider } from './types'
export { OllamaProvider } from './ollama'
export { OpenAIProvider } from './openai'

import type { EmbeddingProvider } from './types'
import { OllamaProvider } from './ollama'
import { OpenAIProvider } from './openai'

export function createEmbeddingProvider(name: string): EmbeddingProvider {
  switch (name) {
    case 'ollama':
      return new OllamaProvider()
    case 'openai':
      return new OpenAIProvider()
    default:
      throw new Error(`Unknown embedding provider "${name}". Supported: ollama, openai`)
  }
}
