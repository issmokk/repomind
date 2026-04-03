import { NextResponse, type NextRequest } from 'next/server'
import { getAuthContext } from '@/app/api/repos/_helpers'
import type { UpdateLinkGroupRequest } from '@/types/cross-repo'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> },
) {
  const auth = await getAuthContext()
  if (auth instanceof NextResponse) return auth

  const { linkId } = await params

  const { data: link, error: linkErr } = await auth.supabase
    .from('repo_links')
    .select('*')
    .eq('id', linkId)
    .eq('org_id', auth.orgId)
    .maybeSingle()

  if (linkErr || !link) {
    return NextResponse.json({ error: 'Link group not found' }, { status: 404 })
  }

  let body: UpdateLinkGroupRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.name && typeof body.name === 'string' && body.name.trim() !== '') {
    await auth.supabase
      .from('repo_links')
      .update({ name: body.name.trim(), updated_at: new Date().toISOString() })
      .eq('id', linkId)
  }

  if (body.addRepoIds && body.addRepoIds.length > 0) {
    const rows = body.addRepoIds.map(repoId => ({
      link_id: linkId,
      repo_id: repoId,
    }))
    await auth.supabase
      .from('repo_link_memberships')
      .upsert(rows, { onConflict: 'link_id,repo_id' })
  }

  if (body.removeRepoIds && body.removeRepoIds.length > 0) {
    await auth.supabase
      .from('repo_link_memberships')
      .delete()
      .eq('link_id', linkId)
      .in('repo_id', body.removeRepoIds)
  }

  const { data: updatedLink, error: fetchErr } = await auth.supabase
    .from('repo_links')
    .select('*')
    .eq('id', linkId)
    .single()

  if (fetchErr || !updatedLink) {
    return NextResponse.json({ error: 'Failed to fetch updated link group' }, { status: 500 })
  }

  const { data: memberships } = await auth.supabase
    .from('repo_link_memberships')
    .select('id, link_id, repo_id, created_at')
    .eq('link_id', linkId)

  return NextResponse.json({
    id: updatedLink.id,
    orgId: updatedLink.org_id,
    name: updatedLink.name,
    createdAt: updatedLink.created_at,
    updatedAt: updatedLink.updated_at,
    memberships: (memberships ?? []).map((m: { id: string; link_id: string; repo_id: string; created_at: string }) => ({
      id: m.id, linkId: m.link_id, repoId: m.repo_id, createdAt: m.created_at,
    })),
  })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> },
) {
  const auth = await getAuthContext()
  if (auth instanceof NextResponse) return auth

  const { linkId } = await params

  const { data: link, error: linkErr } = await auth.supabase
    .from('repo_links')
    .select('id')
    .eq('id', linkId)
    .eq('org_id', auth.orgId)
    .maybeSingle()

  if (linkErr || !link) {
    return NextResponse.json({ error: 'Link group not found' }, { status: 404 })
  }

  await auth.supabase
    .from('repo_links')
    .delete()
    .eq('id', linkId)

  return new NextResponse(null, { status: 204 })
}
