import { NextResponse } from 'next/server'
import { getAuthContext } from '@/app/api/repos/_helpers'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await getAuthContext()
  if (auth instanceof NextResponse) return auth

  const url = new URL(req.url)
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 1),
    200
  )
  const offset = Math.max(
    parseInt(url.searchParams.get('offset') ?? '0', 10) || 0,
    0
  )

  try {
    const messages = await auth.storage.getMessages(
      auth.userId,
      auth.orgId,
      auth.supabase,
      { limit, offset }
    )
    return NextResponse.json(messages)
  } catch (err) {
    console.error('History fetch error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch message history' },
      { status: 500 }
    )
  }
}
