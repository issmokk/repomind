// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getLanguageModel, clearHealthCache, getEmbeddingProvider } from './providers'
import type { TeamSettings } from '@/types/settings'

vi.mock('ollama-ai-provider-v2', () => ({
  createOllama: vi.fn(() => {
    const model = vi.fn(() => ({ modelId: 'ollama-model', provider: 'ollama' }))
    return model
  }),
}))

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => {
    return vi.fn(() => ({ modelId: 'claude-model', provider: 'anthropic' }))
  }),
}))

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => {
    return vi.fn(() => ({ modelId: 'openai-model', provider: 'openai' }))
  }),
}))

vi.mock('@/lib/indexer/embedding/ollama', () => ({
  OllamaProvider: class { name = 'ollama' },
}))

vi.mock('@/lib/indexer/embedding/openai', () => ({
  OpenAIProvider: class { name = 'openai' },
}))

const baseSettings: TeamSettings = {
  id: 'settings-1',
  orgId: 'org-1',
  teamId: 'org-1',
  embeddingProvider: 'ollama',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'gte-qwen2-1.5b-instruct',
  openaiModel: 'text-embedding-3-small',
  providerOrder: ['ollama'],
  claudeApiKey: null,
  claudeModel: 'claude-sonnet-4.6',
  openaiApiKey: null,
  openaiLlmModel: 'gpt-4o',
  cohereApiKey: null,
  maxGraphHops: 2,
  searchTopK: 10,
  searchRrfK: 60,
  createdAt: '',
  updatedAt: '',
}

describe('getLanguageModel', () => {
  beforeEach(() => {
    clearHealthCache()
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('returns Ollama model when healthy', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })
    const model = await getLanguageModel(baseSettings)
    expect(model).toBeDefined()
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/tags',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('falls back to Claude when Ollama is unhealthy', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ECONNREFUSED'))
    const settings = {
      ...baseSettings,
      providerOrder: ['ollama', 'claude'],
      claudeApiKey: 'sk-ant-real-key-here',
    }
    const model = await getLanguageModel(settings)
    expect(model).toBeDefined()
  })

  it('falls back to OpenAI when Ollama and Claude unavailable', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ECONNREFUSED'))
    const settings = {
      ...baseSettings,
      providerOrder: ['ollama', 'claude', 'openai'],
      claudeApiKey: null,
      openaiApiKey: 'sk-openai-real-key',
    }
    const model = await getLanguageModel(settings)
    expect(model).toBeDefined()
  })

  it('throws when no providers available', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ECONNREFUSED'))
    await expect(getLanguageModel(baseSettings)).rejects.toThrow(
      'No LLM provider available'
    )
  })

  it('skips Claude when API key is masked (****)', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ECONNREFUSED'))
    const settings = {
      ...baseSettings,
      providerOrder: ['ollama', 'claude'],
      claudeApiKey: '****abcd',
    }
    await expect(getLanguageModel(settings)).rejects.toThrow(
      'No LLM provider available'
    )
  })

  it('skips OpenAI when API key is empty string', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ECONNREFUSED'))
    const settings = {
      ...baseSettings,
      providerOrder: ['ollama', 'openai'],
      openaiApiKey: '',
    }
    await expect(getLanguageModel(settings)).rejects.toThrow(
      'No LLM provider available'
    )
  })

  it('caches Ollama health check for 30 seconds', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })
    await getLanguageModel(baseSettings)
    await getLanguageModel(baseSettings)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})

describe('getEmbeddingProvider', () => {
  it('creates Ollama embedding provider by default', () => {
    const provider = getEmbeddingProvider(baseSettings)
    expect(provider).toBeDefined()
  })

  it('creates OpenAI embedding provider when configured', () => {
    const settings = { ...baseSettings, embeddingProvider: 'openai' as const }
    const provider = getEmbeddingProvider(settings)
    expect(provider).toBeDefined()
  })
})
