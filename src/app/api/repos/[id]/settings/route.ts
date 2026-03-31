import { NextResponse, type NextRequest } from 'next/server'
import { getRepoContext } from '../../_helpers'

const VALID_PROVIDERS = new Set(['ollama', 'openai', 'gemini'])

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getRepoContext(id)
  if (ctx instanceof NextResponse) return ctx

  const settings = await ctx.storage.getSettings(id, ctx.supabase)
  if (!settings) return NextResponse.json({ error: 'Settings not found' }, { status: 404 })
  return NextResponse.json(settings)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getRepoContext(id)
  if (ctx instanceof NextResponse) return ctx

  const body = await request.json()

  if (body.branchFilter !== undefined) {
    if (!Array.isArray(body.branchFilter) || body.branchFilter.length === 0) {
      return NextResponse.json({ error: 'branchFilter must be a non-empty array' }, { status: 400 })
    }
  }

  if (body.embeddingProvider !== undefined) {
    if (!VALID_PROVIDERS.has(body.embeddingProvider)) {
      return NextResponse.json({ error: `embeddingProvider must be one of: ${[...VALID_PROVIDERS].join(', ')}` }, { status: 400 })
    }
  }

  if (body.includePatterns !== undefined) {
    if (!Array.isArray(body.includePatterns) || !body.includePatterns.every((p: unknown) => typeof p === 'string')) {
      return NextResponse.json({ error: 'includePatterns must be an array of strings' }, { status: 400 })
    }
  }

  if (body.excludePatterns !== undefined) {
    if (!Array.isArray(body.excludePatterns) || !body.excludePatterns.every((p: unknown) => typeof p === 'string')) {
      return NextResponse.json({ error: 'excludePatterns must be an array of strings' }, { status: 400 })
    }
  }

  const allowedFields = ['branchFilter', 'includePatterns', 'excludePatterns', 'embeddingProvider', 'embeddingModel', 'autoIndexOnAdd']
  const sanitized: Record<string, unknown> = {}
  for (const key of allowedFields) {
    if (body[key] !== undefined) sanitized[key] = body[key]
  }

  const updated = await ctx.storage.updateSettings(id, sanitized)
  return NextResponse.json(updated)
}
