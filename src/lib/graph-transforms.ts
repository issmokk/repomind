import type { GraphEdge } from '@/types/graph'

export type NodeData = {
  id: string
  symbolName: string
  symbolType: string | null
  filePath: string | null
}

export type EdgeData = {
  id: string
  source: string
  target: string
  relationshipType: string
}

export type GraphElements = {
  nodes: Array<{ data: NodeData }>
  edges: Array<{ data: EdgeData }>
}

function makeNodeId(file: string | null, symbol: string): string {
  if (!file) return `ext:${symbol}`
  return `${file}:${symbol}`
}

export function edgesToCytoscapeElements(edges: GraphEdge[]): GraphElements {
  const nodeMap = new Map<string, NodeData>()
  const edgeElements: Array<{ data: EdgeData }> = []

  for (const edge of edges) {
    const sourceId = makeNodeId(edge.sourceFile, edge.sourceSymbol)
    if (!nodeMap.has(sourceId)) {
      nodeMap.set(sourceId, {
        id: sourceId,
        symbolName: edge.sourceSymbol,
        symbolType: edge.sourceType,
        filePath: edge.sourceFile,
      })
    }

    const targetId = makeNodeId(edge.targetFile, edge.targetSymbol)
    if (!nodeMap.has(targetId)) {
      nodeMap.set(targetId, {
        id: targetId,
        symbolName: edge.targetSymbol,
        symbolType: edge.targetType,
        filePath: edge.targetFile,
      })
    }

    edgeElements.push({
      data: {
        id: edge.id.toString(),
        source: sourceId,
        target: targetId,
        relationshipType: edge.relationshipType,
      },
    })
  }

  return {
    nodes: Array.from(nodeMap.values()).map((data) => ({ data })),
    edges: edgeElements,
  }
}

