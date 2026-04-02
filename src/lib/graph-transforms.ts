import type { GraphEdge } from '@/types/graph'

export type TreeNodeType = 'repo' | 'directory' | 'file' | 'class' | 'function' | 'method' | 'module' | 'variable' | 'interface' | 'type' | 'enum' | 'package'

export type TreeNodeData = {
  id: string
  name: string
  type: TreeNodeType
  filePath: string | null
  children: TreeNodeData[]
  symbolCount: number
  edgeCount: number
}

function inferTreeNodeType(symbolType: string | null): TreeNodeType {
  if (!symbolType) return 'function'
  const known: TreeNodeType[] = ['class', 'module', 'function', 'method', 'variable', 'interface', 'type', 'enum', 'package']
  if (known.includes(symbolType as TreeNodeType)) return symbolType as TreeNodeType
  return 'function'
}

export function buildTreeFromEdges(edges: GraphEdge[], repoName: string): TreeNodeData {
  const root: TreeNodeData = {
    id: `repo:${repoName}`,
    name: repoName,
    type: 'repo',
    filePath: null,
    children: [],
    symbolCount: 0,
    edgeCount: 0,
  }

  const dirMap = new Map<string, TreeNodeData>()
  const fileMap = new Map<string, TreeNodeData>()
  const symbolMap = new Map<string, TreeNodeData>()
  const symbolEdgeCounts = new Map<string, number>()

  for (const edge of edges) {
    const entries = [
      { file: edge.sourceFile, symbol: edge.sourceSymbol, type: edge.sourceType },
      { file: edge.targetFile, symbol: edge.targetSymbol, type: edge.targetType },
    ]
    for (const entry of entries) {
      if (!entry.file) continue
      const symbolId = `${entry.file}:${entry.symbol}`
      symbolEdgeCounts.set(symbolId, (symbolEdgeCounts.get(symbolId) ?? 0) + 1)

      if (!symbolMap.has(symbolId)) {
        symbolMap.set(symbolId, {
          id: symbolId,
          name: entry.symbol,
          type: inferTreeNodeType(entry.type),
          filePath: entry.file,
          children: [],
          symbolCount: 0,
          edgeCount: 0,
        })
      }

      if (!fileMap.has(entry.file)) {
        fileMap.set(entry.file, {
          id: `file:${entry.file}`,
          name: entry.file.split('/').pop() ?? entry.file,
          type: 'file',
          filePath: entry.file,
          children: [],
          symbolCount: 0,
          edgeCount: 0,
        })
      }
    }
  }

  for (const [symbolId, symbolNode] of symbolMap) {
    symbolNode.edgeCount = symbolEdgeCounts.get(symbolId) ?? 0
    const filePath = symbolNode.filePath!
    const fileNode = fileMap.get(filePath)!
    fileNode.children.push(symbolNode)
  }

  for (const fileNode of fileMap.values()) {
    fileNode.symbolCount = fileNode.children.length
    fileNode.edgeCount = fileNode.children.reduce((sum, c) => sum + c.edgeCount, 0)
    fileNode.children.sort((a, b) => a.name.localeCompare(b.name))
  }

  for (const [filePath, fileNode] of fileMap) {
    const parts = filePath.split('/')
    if (parts.length === 1) {
      root.children.push(fileNode)
      continue
    }

    let currentParent = root
    for (let i = 0; i < parts.length - 1; i++) {
      const dirPath = parts.slice(0, i + 1).join('/')
      let dirNode = dirMap.get(dirPath)
      if (!dirNode) {
        dirNode = {
          id: `dir:${dirPath}`,
          name: parts[i],
          type: 'directory',
          filePath: dirPath,
          children: [],
          symbolCount: 0,
          edgeCount: 0,
        }
        dirMap.set(dirPath, dirNode)
        currentParent.children.push(dirNode)
      }
      currentParent = dirNode
    }
    currentParent.children.push(fileNode)
  }

  function aggregateCounts(node: TreeNodeData): void {
    if (node.type === 'directory' || node.type === 'repo') {
      let symbolCount = 0
      let edgeCount = 0
      for (const child of node.children) {
        aggregateCounts(child)
        symbolCount += child.type === 'directory' || child.type === 'repo' ? child.symbolCount : (child.type === 'file' ? child.symbolCount : 1)
        edgeCount += child.edgeCount
      }
      if (node.type === 'directory') {
        node.symbolCount = symbolCount
        node.edgeCount = edgeCount
      }
      node.children.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1
        if (a.type !== 'directory' && b.type === 'directory') return 1
        return a.name.localeCompare(b.name)
      })
    }
  }

  aggregateCounts(root)
  root.symbolCount = symbolMap.size
  root.edgeCount = Array.from(symbolMap.values()).reduce((sum, s) => sum + s.edgeCount, 0)

  return root
}

export type NodeData = {
  id: string
  symbolName: string
  symbolType: string | null
  filePath: string | null
  repoPrefix: string | null
}

export type EdgeData = {
  id: string
  source: string
  target: string
  relationshipType: string
  isCrossRepo: boolean
  confidence: number | null
}

export type GraphElements = {
  nodes: Array<{ data: NodeData }>
  edges: Array<{ data: EdgeData }>
}

function makeNodeId(file: string | null, symbol: string): string {
  if (!file) return `ext:${symbol}`
  return `${file}:${symbol}`
}

export function edgesToCytoscapeElements(edges: GraphEdge[], repoNameMap?: Map<string, string>): GraphElements {
  const nodeMap = new Map<string, NodeData>()
  const edgeElements: Array<{ data: EdgeData }> = []

  for (const edge of edges) {
    const crossRepo = edge.targetRepoId !== null && edge.targetRepoId !== edge.repoId

    const sourceId = makeNodeId(edge.sourceFile, edge.sourceSymbol)
    if (!nodeMap.has(sourceId)) {
      nodeMap.set(sourceId, {
        id: sourceId,
        symbolName: edge.sourceSymbol,
        symbolType: edge.sourceType,
        filePath: edge.sourceFile,
        repoPrefix: null,
      })
    }

    const targetId = makeNodeId(edge.targetFile, edge.targetSymbol)
    if (!nodeMap.has(targetId)) {
      const repoPrefix = crossRepo && edge.targetRepoId
        ? (repoNameMap?.get(edge.targetRepoId) ?? edge.targetRepoId)
        : null
      nodeMap.set(targetId, {
        id: targetId,
        symbolName: edge.targetSymbol,
        symbolType: edge.targetType,
        filePath: edge.targetFile,
        repoPrefix,
      })
    }

    edgeElements.push({
      data: {
        id: edge.id.toString(),
        source: sourceId,
        target: targetId,
        relationshipType: edge.relationshipType,
        isCrossRepo: crossRepo,
        confidence: edge.confidence ?? null,
      },
    })
  }

  return {
    nodes: Array.from(nodeMap.values()).map((data) => ({ data })),
    edges: edgeElements,
  }
}

