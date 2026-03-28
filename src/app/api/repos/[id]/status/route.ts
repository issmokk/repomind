import { NextResponse, type NextRequest } from 'next/server'
import { getRepoContext } from '../../_helpers'
import { checkAndMarkStaleJob } from '@/lib/indexer/pipeline'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getRepoContext(id)
  if (ctx instanceof NextResponse) return ctx

  const job = await checkAndMarkStaleJob(id, ctx.storage)
  if (!job) {
    const latestJob = await ctx.storage.getLatestJob(id, ctx.supabase)
    if (!latestJob) return NextResponse.json({ status: 'none' })
    return NextResponse.json(latestJob)
  }

  return NextResponse.json(job)
}
