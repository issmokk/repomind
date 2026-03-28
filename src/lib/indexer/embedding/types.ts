export interface EmbeddingProvider {
  readonly name: string
  readonly dimensions: number
  validateDimensions(): Promise<void>
  embed(texts: string[]): Promise<number[][]>
  embedSingle(text: string): Promise<number[]>
}

export async function validateProviderDimensions(provider: EmbeddingProvider): Promise<void> {
  const testVector = await provider.embedSingle('dimension validation test')
  if (testVector.length !== provider.dimensions) {
    throw new Error(
      `Embedding dimension mismatch: expected ${provider.dimensions}, got ${testVector.length}. Model ${provider.name} may have changed.`,
    )
  }
}
