import { Ollama } from 'ollama'
import type { EmbeddingProvider } from './types'
import { validateProviderDimensions } from './types'

const MAX_RETRIES = 3
const RETRY_BASE_MS = 1000
const DEFAULT_TIMEOUT_MS = 30_000

export class OllamaProvider implements EmbeddingProvider {
  readonly name: string
  readonly dimensions = 1536
  private client: Ollama
  private model: string
  private timeoutMs: number

  constructor(model = 'gte-qwen2-1.5b-instruct', baseUrl?: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
    this.model = model
    this.name = `ollama/${model}`
    this.timeoutMs = timeoutMs
    const host = baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
    this.client = new Ollama({ host })
  }

  async validateDimensions(): Promise<void> {
    await validateProviderDimensions(this)
  }

  async embedSingle(text: string): Promise<number[]> {
    let lastError: Error | null = null
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await this.withTimeout(
          this.client.embed({ model: this.model, input: text }),
        )
        return result.embeddings[0]
      } catch (err) {
        lastError = err as Error
        const msg = lastError.message ?? ''
        if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')) {
          await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)))
          continue
        }
        throw lastError
      }
    }
    const host = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
    throw new Error(`Could not connect to Ollama at ${host}. Ensure Ollama is running. Last error: ${lastError?.message}`)
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    const results: number[][] = []
    for (const text of texts) {
      results.push(await this.embedSingle(text))
    }
    return results
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Ollama request timed out after ${this.timeoutMs}ms`)), this.timeoutMs),
      ),
    ])
  }
}
