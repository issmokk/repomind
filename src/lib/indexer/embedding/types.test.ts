// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { validateProviderDimensions } from './types'
import type { EmbeddingProvider } from './types'

function mockProvider(vectorLength: number): EmbeddingProvider {
  return {
    name: 'mock',
    dimensions: 1536,
    validateDimensions: async () => { await validateProviderDimensions(mockProvider(vectorLength)) },
    embed: async () => [],
    embedSingle: async () => Array(vectorLength).fill(0),
  }
}

describe('validateProviderDimensions', () => {
  it('passes when vector length matches dimensions', async () => {
    const provider = mockProvider(1536)
    await expect(validateProviderDimensions(provider)).resolves.toBeUndefined()
  })

  it('throws when dimensions mismatch', async () => {
    const provider = mockProvider(768)
    await expect(validateProviderDimensions(provider)).rejects.toThrow(
      /Embedding dimension mismatch: expected 1536, got 768/,
    )
  })
})
