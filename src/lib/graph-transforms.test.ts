import { describe, it, expect } from 'vitest'
import { edgesToCytoscapeElements } from './graph-transforms'
import type { GraphEdge } from '@/types/graph'

function makeEdge(overrides: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id: 1,
    repoId: 'repo-1',
    targetRepoId: null,
    sourceFile: 'src/a.ts',
    sourceSymbol: 'funcA',
    sourceType: 'function',
    targetFile: 'src/b.ts',
    targetSymbol: 'funcB',
    targetType: 'function',
    relationshipType: 'calls',
    metadata: {},
    confidence: null,
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('edgesToCytoscapeElements', () => {
  it('transforms edges into nodes and edges', () => {
    const edges = [makeEdge()]
    const result = edgesToCytoscapeElements(edges)

    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(1)
  })

  it('deduplicates nodes from edge endpoints', () => {
    const edges = [
      makeEdge({ id: 1, sourceSymbol: 'A', targetSymbol: 'B' }),
      makeEdge({ id: 2, sourceSymbol: 'B', sourceFile: 'src/b.ts', targetSymbol: 'C', targetFile: 'src/c.ts' }),
    ]
    const result = edgesToCytoscapeElements(edges)

    const nodeIds = result.nodes.map((n) => n.data.id)
    expect(new Set(nodeIds).size).toBe(nodeIds.length)
    expect(result.nodes).toHaveLength(3)
  })

  it('node data includes symbolType, filePath, symbolName', () => {
    const edges = [makeEdge({ sourceType: 'class', sourceFile: 'src/foo.ts', sourceSymbol: 'MyClass' })]
    const result = edgesToCytoscapeElements(edges)

    const sourceNode = result.nodes.find((n) => n.data.symbolName === 'MyClass')
    expect(sourceNode).toBeDefined()
    expect(sourceNode!.data.symbolType).toBe('class')
    expect(sourceNode!.data.filePath).toBe('src/foo.ts')
    expect(sourceNode!.data.symbolName).toBe('MyClass')
  })

  it('edge data includes relationshipType and source/target IDs', () => {
    const edges = [makeEdge()]
    const result = edgesToCytoscapeElements(edges)

    const edge = result.edges[0]
    expect(edge.data.source).toBe('src/a.ts:funcA')
    expect(edge.data.target).toBe('src/b.ts:funcB')
    expect(edge.data.relationshipType).toBe('calls')
  })

  it('generates stable node IDs from file+symbol', () => {
    const edges1 = [makeEdge()]
    const edges2 = [makeEdge()]
    const r1 = edgesToCytoscapeElements(edges1)
    const r2 = edgesToCytoscapeElements(edges2)

    expect(r1.nodes.map((n) => n.data.id)).toEqual(r2.nodes.map((n) => n.data.id))
  })

  it('handles null targetFile gracefully', () => {
    const edges = [makeEdge({ targetFile: null, targetSymbol: 'lodash' })]
    const result = edgesToCytoscapeElements(edges)

    const extNode = result.nodes.find((n) => n.data.symbolName === 'lodash')
    expect(extNode).toBeDefined()
    expect(extNode!.data.id).toBe('ext:lodash')
    expect(extNode!.data.filePath).toBeNull()
  })
})

