import { NextResponse, type NextRequest } from 'next/server'
import { getAuthContext } from '@/app/api/repos/_helpers'
import { buildTreeFromEdges } from '@/lib/graph-transforms'
import type { GraphEdge } from '@/types/graph'

const DEFAULT_LIMIT = 500
const MAX_FETCH_LIMIT = 5000

const VALID_SYMBOL_TYPES = new Set(['function', 'class', 'file', 'module', 'package', 'method', 'variable', 'interface', 'type', 'enum'])
const VALID_RELATIONSHIP_TYPES = new Set(['calls', 'imports', 'inherits', 'composes', 'depends_on', 'external_dep', 'gem_dependency', 'npm_dependency', 'event_publish', 'event_subscribe'])
const SAFE_IDENTIFIER = /^[a-zA-Z0-9_.\-/:@<>]+$/

export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (auth instanceof NextResponse) return auth

  const params = request.nextUrl.searchParams
  const format = params.get('format')
  const repoIds = params.get('repoIds')?.split(',').filter(Boolean)
  const symbolTypes = params.get('symbolTypes')?.split(',').filter(Boolean).filter((t) => VALID_SYMBOL_TYPES.has(t))
  const relationshipTypes = params.get('relationshipTypes')?.split(',').filter(Boolean).filter((t) => VALID_RELATIONSHIP_TYPES.has(t))
  const nodeId = params.get('nodeId')
  const topConnected = params.get('topConnected') ? parseInt(params.get('topConnected')!, 10) : undefined
  const includeCrossRepo = params.get('includeCrossRepo') === 'true'
  const minConfidence = params.get('minConfidence') ? parseFloat(params.get('minConfidence')!) : undefined
  const rawLimit = params.get('limit') ? parseInt(params.get('limit')!, 10) : DEFAULT_LIMIT
  const limit = Math.min(Math.max(1, rawLimit), MAX_FETCH_LIMIT)

  if (nodeId && !SAFE_IDENTIFIER.test(nodeId)) {
    return NextResponse.json({ error: 'Invalid nodeId format' }, { status: 400 })
  }

  let query = auth.supabase.from('graph_edges').select('*')

  if (repoIds?.length) {
    query = query.in('repo_id', repoIds)
  }

  if (symbolTypes?.length) {
    query = query.or(
      symbolTypes.map((t) => `source_type.eq.${t}`).join(',') +
        ',' +
        symbolTypes.map((t) => `target_type.eq.${t}`).join(','),
    )
  }

  if (relationshipTypes?.length) {
    query = query.in('relationship_type', relationshipTypes)
  }

  if (!includeCrossRepo) {
    query = query.is('target_repo_id', null)
  } else if (minConfidence !== undefined && !isNaN(minConfidence)) {
    query = query.or(`target_repo_id.is.null,confidence.gte.${minConfidence}`)
  }

  if (nodeId) {
    query = query.or(`source_symbol.eq.${nodeId},target_symbol.eq.${nodeId}`)
    const { data: edges, error } = await query.limit(limit)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return buildResponse(edges ?? [], limit, format)
  }

  if (topConnected) {
    const { data: allEdges, error } = await query.limit(MAX_FETCH_LIMIT)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const edges = allEdges ?? []
    const counts = new Map<string, number>()
    for (const e of edges) {
      counts.set(e.source_symbol, (counts.get(e.source_symbol) ?? 0) + 1)
      counts.set(e.target_symbol, (counts.get(e.target_symbol) ?? 0) + 1)
    }
    const topSymbols = new Set(
      Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, topConnected)
        .map(([sym]) => sym),
    )
    const filtered = edges.filter((e) => topSymbols.has(e.source_symbol) || topSymbols.has(e.target_symbol))
    return buildResponse(filtered, MAX_FETCH_LIMIT, format)
  }

  const { data: edges, error } = await query.limit(limit)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return buildResponse(edges ?? [], limit, format)
}

function buildResponse(edges: Record<string, unknown>[], limit: number, format: string | null = null) {
  const uniqueNodes = new Set<string>()
  for (const e of edges) {
    uniqueNodes.add(`${e.source_file}:${e.source_symbol}`)
    uniqueNodes.add(`${e.target_file ?? 'ext'}:${e.target_symbol}`)
  }

  const camelEdges = edges.map(snakeToCamel)

  if (format === 'tree') {
    const tree = buildTreeFromEdges(camelEdges as GraphEdge[], 'repository')
    return NextResponse.json({
      tree,
      nodeCount: uniqueNodes.size,
      edgeCount: edges.length,
      hasMore: edges.length >= limit,
    })
  }

  return NextResponse.json({
    edges: camelEdges,
    nodeCount: uniqueNodes.size,
    edgeCount: edges.length,
    hasMore: edges.length >= limit,
  })
}

function snakeToCamel(row: Record<string, unknown>) {
  return {
    id: row.id,
    repoId: row.repo_id,
    targetRepoId: row.target_repo_id ?? null,
    sourceFile: row.source_file,
    sourceSymbol: row.source_symbol,
    sourceType: row.source_type,
    targetFile: row.target_file,
    targetSymbol: row.target_symbol,
    targetType: row.target_type,
    relationshipType: row.relationship_type,
    metadata: row.metadata,
    confidence: row.confidence ?? null,
    createdAt: row.created_at,
  }
}
