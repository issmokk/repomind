import type { EmbeddingProvider } from './types'
import { validateProviderDimensions } from './types'

const MAX_BATCH_SIZE = 100
const MAX_RETRIES = 3

export class OpenAIProvider implements EmbeddingProvider {
  readonly name = 'openai/text-embedding-3-small'
  readonly dimensions = 1536
  private apiKey: string
  private model: string

  constructor(model = 'text-embedding-3-small') {
    const key = process.env.OPENAI_API_KEY
    if (!key) throw new Error('OPENAI_API_KEY environment variable is not set')
    this.apiKey = key
    this.model = model
  }

  async validateDimensions(): Promise<void> {
    await validateProviderDimensions(this)
  }

  async embedSingle(text: string): Promise<number[]> {
    const [result] = await this.embed([text])
    return result
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    const results: number[][] = []
    for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
      const batch = texts.slice(i, i + MAX_BATCH_SIZE)
      const embeddings = await this.callApi(batch)
      results.push(...embeddings)
    }
    return results
  }

  private async callApi(input: string[]): Promise<number[][]> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: this.model, input }),
      })

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') ?? '2', 10)
        await new Promise((r) => setTimeout(r, retryAfter * 1000))
        continue
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        lastError = new Error(`OpenAI API error ${response.status}: ${body}`)
        throw lastError
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[]; index: number }>
      }
      return data.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding)
    }

    throw lastError ?? new Error('OpenAI API failed after retries')
  }
}
