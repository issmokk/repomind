import type { EmbeddingProvider } from './types'
import { validateProviderDimensions } from './types'

const MAX_RETRIES = 2
const RETRY_BASE_MS = 1000

export class GeminiProvider implements EmbeddingProvider {
  readonly name: string
  readonly dimensions = 3072
  private apiKey: string
  private model: string

  constructor(apiKey: string, model = 'gemini-embedding-001') {
    if (!apiKey) throw new Error('Gemini API key is required for embedding')
    this.apiKey = apiKey
    this.model = model
    this.name = `gemini/${model}`
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
    for (const text of texts) {
      results.push(await this.callApi(text))
    }
    return results
  }

  private async callApi(text: string): Promise<number[]> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent?key=${this.apiKey}`
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: `models/${this.model}`,
            content: { parts: [{ text }] },
          }),
          signal: AbortSignal.timeout(10_000),
        })

        if (response.status === 429) {
          await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)))
          continue
        }

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          throw new Error(`Gemini embedding API error ${response.status}: ${body}`)
        }

        const data = (await response.json()) as {
          embedding: { values: number[] }
        }
        return data.embedding.values
      } catch (err) {
        lastError = err as Error
        const msg = lastError.message ?? ''
        if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('abort') || msg.includes('timeout')) {
          await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)))
          continue
        }
        throw lastError
      }
    }

    throw new Error(`Gemini embedding API failed after ${MAX_RETRIES} retries. Last error: ${lastError?.message ?? 'unknown'}. Key length: ${this.apiKey.length}`)
  }
}
