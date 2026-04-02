'use client'

import { useMemo } from 'react'
import { buildTreeFromEdges, type TreeNodeData } from '@/lib/graph-transforms'
import type { GraphEdge } from '@/types/graph'

export type { TreeNodeData, TreeNodeType } from '@/lib/graph-transforms'
export { buildTreeFromEdges } from '@/lib/graph-transforms'

export function useTreeData(edges: GraphEdge[], repoName: string): TreeNodeData | null {
  return useMemo(() => {
    if (!edges.length) return null
    return buildTreeFromEdges(edges, repoName)
  }, [edges, repoName])
}
