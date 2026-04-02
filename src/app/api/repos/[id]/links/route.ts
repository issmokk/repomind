import { NextResponse, type NextRequest } from 'next/server'
import { getRepoContext } from '../../_helpers'
import type { CreateLinkGroupRequest } from '@/types/cross-repo'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getRepoContext(id)
  if (ctx instanceof NextResponse) return ctx

  const { data: memberships, error: memErr } = await ctx.supabase
    .from('repo_link_memberships')
    .select('link_id')
    .eq('repo_id', id)

  if (memErr) {
    return NextResponse.json({ error: 'Failed to fetch memberships' }, { status: 500 })
  }

  const linkIds = (memberships ?? []).map((m: { link_id: string }) => m.link_id)
  if (linkIds.length === 0) {
    return NextResponse.json([])
  }

  const { data: links, error: linkErr } = await ctx.supabase
    .from('repo_links')
    .select('*')
    .in('id', linkIds)

  if (linkErr) {
    return NextResponse.json({ error: 'Failed to fetch link groups' }, { status: 500 })
  }

  const result = await Promise.all(
    (links ?? []).map(async (link: { id: string; org_id: string; name: string; created_at: string; updated_at: string }) => {
      const { data: allMemberships } = await ctx.supabase
        .from('repo_link_memberships')
        .select('id, link_id, repo_id, created_at')
        .eq('link_id', link.id)

      const repoIds = (allMemberships ?? []).map((m: { repo_id: string }) => m.repo_id)
      let repos: Array<{ id: string; name: string; fullName: string }> = []
      if (repoIds.length > 0) {
        const repoResults = await Promise.all(
          repoIds.map((rid: string) => ctx.storage.getRepository(rid, ctx.supabase))
        )
        repos = repoResults
          .filter((r): r is NonNullable<typeof r> => r !== null)
          .map(r => ({ id: r.id, name: r.name, fullName: r.fullName }))
      }

      return {
        id: link.id,
        orgId: link.org_id,
        name: link.name,
        createdAt: link.created_at,
        updatedAt: link.updated_at,
        memberships: (allMemberships ?? []).map((m: { id: string; link_id: string; repo_id: string; created_at: string }) => ({
          id: m.id, linkId: m.link_id, repoId: m.repo_id, createdAt: m.created_at,
        })),
        repos,
      }
    })
  )

  return NextResponse.json(result)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getRepoContext(id)
  if (ctx instanceof NextResponse) return ctx

  let body: CreateLinkGroupRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const { data: link, error: linkErr } = await ctx.supabase
    .from('repo_links')
    .insert({ org_id: ctx.orgId, name: body.name.trim() })
    .select()
    .single()

  if (linkErr || !link) {
    return NextResponse.json({ error: 'Failed to create link group' }, { status: 500 })
  }

  const repoIds = Array.from(new Set([id, ...(body.repoIds ?? [])]))
  const membershipRows = repoIds.map((repoId: string) => ({
    link_id: link.id,
    repo_id: repoId,
  }))

  await ctx.supabase
    .from('repo_link_memberships')
    .insert(membershipRows)

  return NextResponse.json({
    id: link.id,
    orgId: link.org_id,
    name: link.name,
    createdAt: link.created_at,
    updatedAt: link.updated_at,
    repoIds,
  }, { status: 201 })
}
