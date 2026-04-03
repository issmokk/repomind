import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getRepoContext } from '../../_helpers'

const settingsUpdateSchema = z.object({
  branchFilter: z.array(z.string().min(1)).min(1).optional(),
  includePatterns: z.array(z.string()).optional(),
  excludePatterns: z.array(z.string()).optional(),
  embeddingProvider: z.enum(['ollama', 'openai', 'gemini']).optional(),
  embeddingModel: z.string().min(1).max(100).optional(),
  indexingMethod: z.enum(['manual', 'webhook', 'git_diff', 'cron']).optional(),
  autoIndexOnAdd: z.boolean().optional(),
}).strict()

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

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = settingsUpdateSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid settings', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const updated = await ctx.storage.updateSettings(id, parsed.data)
  return NextResponse.json(updated)
}
