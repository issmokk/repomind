import { NextResponse, type NextRequest } from 'next/server'
import { getRepoContext } from '../_helpers'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getRepoContext(id)
  if (ctx instanceof NextResponse) return ctx

  return NextResponse.json(ctx.repo)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getRepoContext(id)
  if (ctx instanceof NextResponse) return ctx

  await ctx.storage.deleteRepository(id)
  return NextResponse.json({ success: true })
}
