import { NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest/client'

export async function POST() {
  await inngest.send({ name: 'debug/fetch', data: {} })
  return NextResponse.json({ ok: true, message: 'Debug fetch triggered. Check Inngest dashboard for results.' })
}
