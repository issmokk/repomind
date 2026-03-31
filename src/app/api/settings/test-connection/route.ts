import { NextResponse } from 'next/server'
import { getAuthContext } from '@/app/api/repos/_helpers'

export const runtime = 'nodejs'

const BLOCKED_HOSTS = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.|\[::1\]|\[fe80:)/i

function isBlockedUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr)
    return BLOCKED_HOSTS.test(url.hostname)
  } catch {
    return true
  }
}

export async function POST(req: Request) {
  const auth = await getAuthContext()
  if (auth instanceof NextResponse) return auth

  let body: { provider: string; config: Record<string, string> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { provider, config } = body

  try {
    switch (provider) {
      case 'ollama': {
        const baseUrl = config.ollamaBaseUrl || 'http://localhost:11434'
        if (baseUrl !== 'http://localhost:11434' && isBlockedUrl(baseUrl)) {
          return NextResponse.json({ success: false, message: 'URL not allowed' })
        }
        const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) })
        if (!res.ok) throw new Error(`Ollama returned ${res.status}`)
        return NextResponse.json({ success: true, message: 'Connected to Ollama' })
      }
      case 'claude': {
        const apiKey = config.claudeApiKey
        if (!apiKey) return NextResponse.json({ success: false, message: 'API key required' })
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error((err as Record<string, unknown>).error?.toString() ?? `API returned ${res.status}`)
        }
        return NextResponse.json({ success: true, message: 'Connected to Anthropic' })
      }
      case 'openai': {
        const apiKey = config.openaiApiKey
        if (!apiKey) return NextResponse.json({ success: false, message: 'API key required' })
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) throw new Error(`OpenAI returned ${res.status}`)
        return NextResponse.json({ success: true, message: 'Connected to OpenAI' })
      }
      case 'gemini': {
        const apiKey = config.geminiApiKey
        if (!apiKey) return NextResponse.json({ success: false, message: 'API key required' })
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) throw new Error(`Gemini returned ${res.status}`)
        return NextResponse.json({ success: true, message: 'Connected to Google Gemini' })
      }
      case 'cohere': {
        const apiKey = config.cohereApiKey
        if (!apiKey) return NextResponse.json({ success: false, message: 'API key required' })
        const res = await fetch('https://api.cohere.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) throw new Error(`Cohere returned ${res.status}`)
        return NextResponse.json({ success: true, message: 'Connected to Cohere' })
      }
      default:
        return NextResponse.json({ success: false, message: `Unknown provider: ${provider}` })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed'
    return NextResponse.json({ success: false, message })
  }
}
