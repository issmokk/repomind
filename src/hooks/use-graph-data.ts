'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import { edgesToCytoscapeElements, type GraphElements } from '@/lib/graph-transforms'
import type { GraphEdge } from '@/types/graph'

export type GraphFilters = {
  repoIds?: string[]
  symbolTypes?: string[]
  relationshipTypes?: string[]
  topConnected?: number
  showCrossRepo?: boolean
  confidenceThreshold?: number
}

type GraphResponse = {
  edges: GraphEdge[]
  nodeCount: number
  edgeCount: number
  hasMore: boolean
}

function buildKey(filters: GraphFilters): string {
  const params = new URLSearchParams()
  if (filters.repoIds?.length) params.set('repoIds', filters.repoIds.join(','))
  if (filters.symbolTypes?.length) params.set('symbolTypes', filters.symbolTypes.join(','))
  if (filters.relationshipTypes?.length) params.set('relationshipTypes', filters.relationshipTypes.join(','))
  if (filters.topConnected) params.set('topConnected', String(filters.topConnected))
  if (filters.showCrossRepo) params.set('includeCrossRepo', 'true')
  if (filters.showCrossRepo && filters.confidenceThreshold) params.set('minConfidence', String(filters.confidenceThreshold))
  const qs = params.toString()
  return `/api/graph${qs ? '?' + qs : ''}`
}

export function useGraphData(filters: GraphFilters) {
  const key = buildKey(filters)

  const { data, error, isLoading, mutate } = useSWR<GraphResponse>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  })

  const elements: GraphElements | undefined = useMemo(
    () => (data ? edgesToCytoscapeElements(data.edges) : undefined),
    [data],
  )

  async function expandNode(nodeId: string) {
    const params = new URLSearchParams({ nodeId, includeCrossRepo: 'true' })
    const res = await fetch(`/api/graph?${params}`)
    if (!res.ok) return
    const expansion: GraphResponse = await res.json()

    mutate((prev) => {
      if (!prev) return prev
      const existingEdgeIds = new Set(prev.edges.map((e) => e.id))
      const mergedEdges = [
        ...prev.edges,
        ...expansion.edges.filter((e) => !existingEdgeIds.has(e.id)),
      ]
      const uniqueNodes = new Set<string>()
      for (const e of mergedEdges) {
        uniqueNodes.add(`${e.sourceFile}:${e.sourceSymbol}`)
        uniqueNodes.add(`${e.targetFile ?? 'ext'}:${e.targetSymbol}`)
      }
      return {
        ...prev,
        edges: mergedEdges,
        edgeCount: mergedEdges.length,
        nodeCount: uniqueNodes.size,
        hasMore: prev.hasMore,
      }
    }, { revalidate: false })
  }

  return {
    edges: data?.edges ?? [],
    elements,
    nodeCount: data?.nodeCount ?? 0,
    edgeCount: data?.edgeCount ?? 0,
    hasMore: data?.hasMore ?? false,
    isLoading,
    error,
    expandNode,
  }
}
