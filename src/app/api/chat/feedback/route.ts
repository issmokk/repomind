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
    const messages = await auth.storage.getMessages(
      auth.userId,
      auth.orgId,
      auth.supabase,
      { limit: 1, offset: 0 }
    )
    const allOrgMessages = await auth.supabase
      .from('chat_messages')
      .select('id')
      .eq('id', messageId)
      .eq('org_id', auth.orgId)
      .maybeSingle()

    if (!allOrgMessages.data) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    await auth.storage.saveFeedback({
      messageId,
      userId: auth.userId,
      rating: rating as 'up' | 'down',
      comment: comment ?? null,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    if (errMsg.includes('23503')) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }
    if (errMsg.includes('23505')) {
      return NextResponse.json({ error: 'Feedback already submitted for this message' }, { status: 409 })
    }
    console.error('Feedback save error:', err)
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }
}
