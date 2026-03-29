// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('ollama', () => {
  class MockOllama { embed = vi.fn(); constructor(_opts?: unknown) {} }
  return { Ollama: MockOllama }
})

import { createEmbeddingProvider } from './index'
import { OllamaProvider } from './ollama'
import { OpenAIProvider } from './openai'

describe('createEmbeddingProvider', () => {
  const originalKey = process.env.OPENAI_API_KEY

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-test'
  })

  afterEach(() => {
    if (originalKey !== undefined) process.env.OPENAI_API_KEY = originalKey
    else delete process.env.OPENAI_API_KEY
  })

  it('returns OllamaProvider for "ollama"', () => {
    expect(createEmbeddingProvider('ollama')).toBeInstanceOf(OllamaProvider)
  })

  it('returns OpenAIProvider for "openai"', () => {
    expect(createEmbeddingProvider('openai')).toBeInstanceOf(OpenAIProvider)
  })

  it('throws for unknown provider', () => {
    expect(() => createEmbeddingProvider('unknown')).toThrow(/Unknown embedding provider "unknown"/)
  })
})
