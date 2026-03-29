// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OpenAIProvider } from './openai'

function mockFetchResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response
}

describe('OpenAIProvider', () => {
  const originalKey = process.env.OPENAI_API_KEY
  const fakeVector = Array(1536).fill(0.1)

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-test123'
    vi.restoreAllMocks()
  })

  afterEach(() => {
    if (originalKey !== undefined) process.env.OPENAI_API_KEY = originalKey
    else delete process.env.OPENAI_API_KEY
  })

  it('embedSingle returns vector of correct length', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(
      mockFetchResponse({ data: [{ embedding: fakeVector, index: 0 }] }),
    )))
    const provider = new OpenAIProvider()
    const result = await provider.embedSingle('hello')
    expect(result).toHaveLength(1536)
  })

  it('embed batches up to 100 texts per API call', async () => {
    let callCount = 0
    const fetchMock = vi.fn(() => {
      const batchSize = callCount === 0 ? 100 : 50
      callCount++
      return Promise.resolve(
        mockFetchResponse({
          data: Array.from({ length: batchSize }, (_, i) => ({ embedding: fakeVector, index: i })),
        }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OpenAIProvider()
    const texts = Array(150).fill('test')
    const results = await provider.embed(texts)

    expect(results).toHaveLength(150)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('requires OPENAI_API_KEY env var', () => {
    delete process.env.OPENAI_API_KEY
    expect(() => new OpenAIProvider()).toThrow('OPENAI_API_KEY environment variable is not set')
  })

  it('429 rate limit triggers retry', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockFetchResponse({}, 429, { 'Retry-After': '0' }))
      .mockResolvedValueOnce(mockFetchResponse({ data: [{ embedding: fakeVector, index: 0 }] }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OpenAIProvider()
    const result = await provider.embedSingle('test')
    expect(result).toHaveLength(1536)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
