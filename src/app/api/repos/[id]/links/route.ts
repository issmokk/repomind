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

  const [linksResult, allMembershipsResult] = await Promise.all([
    ctx.supabase.from('repo_links').select('*').in('id', linkIds),
    ctx.supabase
      .from('repo_link_memberships')
      .select('id, link_id, repo_id, created_at')
      .in('link_id', linkIds),
  ])

  if (linksResult.error) {
    return NextResponse.json({ error: 'Failed to fetch link groups' }, { status: 500 })
  }

  const membershipsByLink = new Map<string, Array<{ id: string; link_id: string; repo_id: string; created_at: string }>>()
  for (const m of allMembershipsResult.data ?? []) {
    const list = membershipsByLink.get(m.link_id) ?? []
    list.push(m)
    membershipsByLink.set(m.link_id, list)
  }

  const allRepoIds = [...new Set((allMembershipsResult.data ?? []).map((m: { repo_id: string }) => m.repo_id))]
  const { data: repos } = allRepoIds.length > 0
    ? await ctx.supabase
        .from('repositories')
        .select('id, name, full_name')
        .in('id', allRepoIds)
    : { data: [] as Array<{ id: string; name: string; full_name: string }> }

  const repoMap = new Map((repos ?? []).map((r: { id: string; name: string; full_name: string }) => [r.id, r]))

  const result = (linksResult.data ?? []).map((link: { id: string; org_id: string; name: string; created_at: string; updated_at: string }) => {
    const linkMemberships = membershipsByLink.get(link.id) ?? []
    const linkRepos = linkMemberships
      .map(m => repoMap.get(m.repo_id))
      .filter((r): r is NonNullable<typeof r> => r != null)
      .map(r => ({ id: r.id, name: r.name, fullName: r.full_name }))

    return {
      id: link.id,
      orgId: link.org_id,
      name: link.name,
      createdAt: link.created_at,
      updatedAt: link.updated_at,
      memberships: linkMemberships.map(m => ({
        id: m.id, linkId: m.link_id, repoId: m.repo_id, createdAt: m.created_at,
      })),
      repos: linkRepos,
    }
  })

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
