import type { LanguageModel } from 'ai'
import type { TeamSettings } from '@/types/settings'
import type { EmbeddingProvider } from '@/lib/indexer/embedding/types'
import { OllamaProvider } from '@/lib/indexer/embedding/ollama'
import { OpenAIProvider } from '@/lib/indexer/embedding/openai'

let ollamaHealthCache: { healthy: boolean; checkedAt: number } | null = null
const HEALTH_CACHE_TTL_MS = 30_000
const HEALTH_CHECK_TIMEOUT_MS = 2_000

async function checkOllamaHealth(baseUrl: string): Promise<boolean> {
  if (
    ollamaHealthCache &&
    Date.now() - ollamaHealthCache.checkedAt < HEALTH_CACHE_TTL_MS
  ) {
    return ollamaHealthCache.healthy
  }

  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
    })
    const healthy = response.ok
    ollamaHealthCache = { healthy, checkedAt: Date.now() }
    return healthy
  } catch {
    ollamaHealthCache = { healthy: false, checkedAt: Date.now() }
    return false
  }
}

export function clearHealthCache(): void {
  ollamaHealthCache = null
}

export async function getLanguageModel(
  teamSettings: TeamSettings
): Promise<LanguageModel> {
  for (const provider of teamSettings.providerOrder) {
    switch (provider) {
      case 'ollama': {
        const baseUrl = teamSettings.ollamaBaseUrl || 'http://localhost:11434'
        const healthy = await checkOllamaHealth(baseUrl)
        if (healthy) {
          const { createOllama } = await import('ollama-ai-provider-v2')
          const ollama = createOllama({ baseURL: `${baseUrl}/api` })
          return ollama('qwen2:1.5b') as LanguageModel
        }
        break
      }
      case 'claude': {
        if (teamSettings.claudeApiKey && !teamSettings.claudeApiKey.startsWith('****')) {
          const { createAnthropic } = await import('@ai-sdk/anthropic')
          const anthropic = createAnthropic({ apiKey: teamSettings.claudeApiKey })
          return anthropic(teamSettings.claudeModel || 'claude-sonnet-4.6') as LanguageModel
        }
        break
      }
      case 'openai': {
        if (teamSettings.openaiApiKey && !teamSettings.openaiApiKey.startsWith('****')) {
          const { createOpenAI } = await import('@ai-sdk/openai')
          const openai = createOpenAI({ apiKey: teamSettings.openaiApiKey })
          return openai(teamSettings.openaiLlmModel || 'gpt-4o') as LanguageModel
        }
        break
      }
    }
  }

  throw new Error(
    'No LLM provider available. Configure providers in Team Settings: Ollama (start server), Claude (add API key), or OpenAI (add API key).'
  )
}

export function getEmbeddingProvider(teamSettings: TeamSettings): EmbeddingProvider {
  const provider = teamSettings.embeddingProvider || 'ollama'
  if (provider === 'openai') {
    return new OpenAIProvider(teamSettings.openaiModel || undefined)
  }
  return new OllamaProvider(
    teamSettings.ollamaModel || undefined,
    teamSettings.ollamaBaseUrl || undefined
  )
}
