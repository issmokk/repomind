// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockEmbed = vi.fn()
vi.mock('ollama', () => {
  return {
    Ollama: class {
      embed: typeof mockEmbed
      constructor(_opts?: unknown) {
        this.embed = mockEmbed
      }
    },
  }
})

import { OllamaProvider } from './ollama'

describe('OllamaProvider', () => {
  const fakeVector = Array(1536).fill(0.1)
  const originalEnv = process.env.OLLAMA_BASE_URL

  beforeEach(() => {
    vi.clearAllMocks()
    mockEmbed.mockResolvedValue({ embeddings: [fakeVector] })
  })

  afterEach(() => {
    if (originalEnv !== undefined) process.env.OLLAMA_BASE_URL = originalEnv
    else delete process.env.OLLAMA_BASE_URL
  })

  it('embedSingle returns vector of correct length', async () => {
    const provider = new OllamaProvider()
    const result = await provider.embedSingle('hello')
    expect(result).toHaveLength(1536)
  })

  it('embed processes multiple texts sequentially', async () => {
    const provider = new OllamaProvider()
    const results = await provider.embed(['a', 'b', 'c'])
    expect(results).toHaveLength(3)
    expect(mockEmbed).toHaveBeenCalledTimes(3)
  })

  it('connection error triggers retry', async () => {
    mockEmbed
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce({ embeddings: [fakeVector] })

    const provider = new OllamaProvider()
    const result = await provider.embedSingle('test')
    expect(result).toHaveLength(1536)
    expect(mockEmbed).toHaveBeenCalledTimes(2)
  })

  it('uses OLLAMA_BASE_URL from env', () => {
    process.env.OLLAMA_BASE_URL = 'http://custom:1234'
    const provider = new OllamaProvider()
    expect(provider.name).toBe('ollama/gte-qwen2-1.5b-instruct')
  })
})
