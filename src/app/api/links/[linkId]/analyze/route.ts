import { NextResponse } from 'next/server'
import { getAuthContext } from '@/app/api/repos/_helpers'
import { GitHubClient, PersonalAccessTokenAuth } from '@/lib/github'
import { defaultRegistry } from '@/lib/cross-repo/analyzer-registry'
import type { GraphEdgeInsert } from '@/types/graph'
import type { CrossRepoRelationshipType } from '@/types/cross-repo'
import type { Repository } from '@/types/repository'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const auth = await getAuthContext()
  if (auth instanceof NextResponse) return auth

  const { linkId } = await params

  const { data: link, error: linkError } = await auth.supabase
    .from('repo_links')
    .select('*')
    .eq('id', linkId)
    .maybeSingle()

  if (linkError || !link) {
    return NextResponse.json({ error: 'Link group not found' }, { status: 404 })
  }

  if (link.org_id !== auth.orgId) {
    return NextResponse.json({ error: 'Link group not found' }, { status: 404 })
  }

  const { data: memberships } = await auth.supabase
    .from('repo_link_memberships')
    .select('repo_id')
    .eq('link_id', linkId)

  const repoIds = (memberships ?? []).map((m: { repo_id: string }) => m.repo_id)
  if (repoIds.length === 0) {
    return NextResponse.json({ edgeCount: 0, byType: {}, skippedRepos: [] })
  }

  const repos = await Promise.all(
    repoIds.map((id: string) => auth.storage.getRepository(id, auth.supabase))
  )
  const allRepos = repos.filter((r): r is Repository => r !== null)

  const indexedRepos = allRepos.filter((r) => r.lastIndexedCommit !== null)
  const skippedRepos = allRepos
    .filter((r) => r.lastIndexedCommit === null)
    .map((r) => r.id)

  const ghAuth = new PersonalAccessTokenAuth()
  const ghClient = new GitHubClient(ghAuth)

  const edges = await defaultRegistry.runAll(indexedRepos, auth.storage, ghClient)

  await auth.storage.deleteCrossRepoEdges(repoIds)

  if (edges.length > 0) {
    const inserts: GraphEdgeInsert[] = edges.map((e) => ({
      repoId: e.sourceRepoId,
      targetRepoId: e.targetRepoId,
      sourceFile: e.sourceFile,
      sourceSymbol: e.sourceSymbol,
      sourceType: null,
      targetFile: e.targetFile,
      targetSymbol: e.targetSymbol,
      targetType: null,
      relationshipType: e.relationshipType,
      confidence: e.confidence,
      metadata: e.metadata,
    }))
    await auth.storage.upsertEdges(inserts)
  }

  const byType: Record<string, number> = {}
  for (const edge of edges) {
    byType[edge.relationshipType] = (byType[edge.relationshipType] ?? 0) + 1
  }

  return NextResponse.json({
    edgeCount: edges.length,
    byType: byType as Record<CrossRepoRelationshipType, number>,
    skippedRepos,
  })
}
