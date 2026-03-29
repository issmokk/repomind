import { NextResponse } from 'next/server'
import { getAuthContext } from '@/app/api/repos/_helpers'

export const runtime = 'nodejs'

const VALID_PROVIDERS = new Set(['ollama', 'claude', 'openai'])

export async function GET() {
  const auth = await getAuthContext()
  if (auth instanceof NextResponse) return auth

  try {
    const settings = await auth.storage.getTeamSettings(auth.orgId)
    return NextResponse.json(settings)
  } catch (err) {
    console.error('Failed to fetch team settings:', err)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const auth = await getAuthContext()
  if (auth instanceof NextResponse) return auth

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (body.searchTopK !== undefined) {
    const v = Number(body.searchTopK)
    if (!Number.isInteger(v) || v < 1 || v > 50) {
      return NextResponse.json({ error: 'searchTopK must be an integer between 1 and 50' }, { status: 400 })
    }
  }

  if (body.maxGraphHops !== undefined) {
    const v = Number(body.maxGraphHops)
    if (!Number.isInteger(v) || v < 0 || v > 5) {
      return NextResponse.json({ error: 'maxGraphHops must be an integer between 0 and 5' }, { status: 400 })
    }
  }

  if (body.providerOrder !== undefined) {
    if (!Array.isArray(body.providerOrder)) {
      return NextResponse.json({ error: 'providerOrder must be an array' }, { status: 400 })
    }
    const seen = new Set<string>()
    for (const p of body.providerOrder) {
      if (!VALID_PROVIDERS.has(p as string)) {
        return NextResponse.json({ error: `Invalid provider: ${p}` }, { status: 400 })
      }
      if (seen.has(p as string)) {
        return NextResponse.json({ error: 'providerOrder must not contain duplicates' }, { status: 400 })
      }
      seen.add(p as string)
    }
  }

  if (body.ollamaBaseUrl !== undefined && typeof body.ollamaBaseUrl === 'string') {
    if (!body.ollamaBaseUrl.startsWith('http://') && !body.ollamaBaseUrl.startsWith('https://')) {
      return NextResponse.json({ error: 'ollamaBaseUrl must start with http:// or https://' }, { status: 400 })
    }
  }

  const ALLOWED_FIELDS = new Set([
    'providerOrder', 'ollamaBaseUrl', 'ollamaModel', 'ollamaLlmModel',
    'claudeApiKey', 'claudeModel', 'openaiApiKey', 'openaiLlmModel',
    'cohereApiKey', 'searchTopK', 'maxGraphHops', 'searchRrfK',
    'embeddingProvider', 'openaiModel',
  ])
  const filtered: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(key)) filtered[key] = value
  }

  try {
    const settings = await auth.storage.updateTeamSettings(auth.orgId, filtered)
    return NextResponse.json(settings)
  } catch (err) {
    console.error('Failed to update team settings:', err)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
