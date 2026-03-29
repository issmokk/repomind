import { NextResponse } from 'next/server'
import { getAuthContext } from '@/app/api/repos/_helpers'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await getAuthContext()
  if (auth instanceof NextResponse) return auth

  let body: { messageId?: string; rating?: string; comment?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { messageId, rating, comment } = body

  if (!messageId || typeof messageId !== 'string') {
    return NextResponse.json({ error: 'messageId is required' }, { status: 400 })
  }
  if (!rating || (rating !== 'up' && rating !== 'down')) {
    return NextResponse.json(
      { error: 'rating must be "up" or "down"' },
      { status: 400 }
    )
  }

  try {
    await auth.storage.saveFeedback({
      messageId,
      userId: auth.userId,
      rating: rating as 'up' | 'down',
      comment: comment ?? null,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('23503')) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }
    console.error('Feedback save error:', err)
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }
}
