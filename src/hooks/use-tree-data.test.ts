import { describe, it, expect } from 'vitest'
import { buildTreeFromEdges, type TreeNodeData } from '@/lib/graph-transforms'
import type { GraphEdge } from '@/types/graph'

function makeEdge(overrides: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id: 1,
    repoId: 'repo-1',
    targetRepoId: null,
    sourceFile: 'src/actions/pay.rb',
    sourceSymbol: 'PayAction',
    sourceType: 'class',
    targetFile: 'src/models/payment.rb',
    targetSymbol: 'Payment',
    targetType: 'class',
    relationshipType: 'calls',
    metadata: {},
    createdAt: '2024-01-01',
    ...overrides,
  }
}

function findNode(root: TreeNodeData, predicate: (n: TreeNodeData) => boolean): TreeNodeData | null {
  if (predicate(root)) return root
  for (const child of root.children) {
    const found = findNode(child, predicate)
    if (found) return found
  }
  return null
}

describe('buildTreeFromEdges', () => {
  it('transforms flat edges into nested tree structure', () => {
    const edges = [
      makeEdge({
        sourceFile: 'src/actions/pay.rb',
        sourceSymbol: 'PayAction',
        targetFile: 'src/models/payment.rb',
        targetSymbol: 'Payment',
      }),
    ]

    const tree = buildTreeFromEdges(edges, 'my-repo')

    expect(tree.type).toBe('repo')
    expect(tree.name).toBe('my-repo')

    const srcDir = findNode(tree, (n) => n.id === 'dir:src')
    expect(srcDir).toBeTruthy()
    expect(srcDir!.type).toBe('directory')

    const actionsDir = findNode(tree, (n) => n.id === 'dir:src/actions')
    expect(actionsDir).toBeTruthy()

    const payFile = findNode(tree, (n) => n.id === 'file:src/actions/pay.rb')
    expect(payFile).toBeTruthy()
    expect(payFile!.type).toBe('file')

    const paySymbol = findNode(tree, (n) => n.id === 'src/actions/pay.rb:PayAction')
    expect(paySymbol).toBeTruthy()
    expect(paySymbol!.type).toBe('class')
  })

  it('aggregates dependency counts up the tree', () => {
    const edges = [
      makeEdge({ id: 1, sourceFile: 'src/a.rb', sourceSymbol: 'A', targetFile: 'src/b.rb', targetSymbol: 'B' }),
      makeEdge({ id: 2, sourceFile: 'src/a.rb', sourceSymbol: 'A', targetFile: 'src/c.rb', targetSymbol: 'C' }),
      makeEdge({ id: 3, sourceFile: 'src/a.rb', sourceSymbol: 'A', targetFile: 'src/d.rb', targetSymbol: 'D' }),
      makeEdge({ id: 4, sourceFile: 'src/b.rb', sourceSymbol: 'B', targetFile: 'src/c.rb', targetSymbol: 'C' }),
      makeEdge({ id: 5, sourceFile: 'src/b.rb', sourceSymbol: 'B', targetFile: 'src/d.rb', targetSymbol: 'D' }),
    ]

    const tree = buildTreeFromEdges(edges, 'repo')
    const srcDir = findNode(tree, (n) => n.id === 'dir:src')
    expect(srcDir).toBeTruthy()
    expect(srcDir!.edgeCount).toBeGreaterThan(0)

    const fileA = findNode(tree, (n) => n.id === 'file:src/a.rb')
    const fileB = findNode(tree, (n) => n.id === 'file:src/b.rb')
    expect(fileA!.edgeCount + fileB!.edgeCount).toBeLessThanOrEqual(srcDir!.edgeCount)
  })

  it('handles files at the repo root (no directory)', () => {
    const edges = [
      makeEdge({ sourceFile: 'Gemfile', sourceSymbol: 'bundler', sourceType: 'module', targetFile: 'app.rb', targetSymbol: 'App', targetType: 'class' }),
    ]

    const tree = buildTreeFromEdges(edges, 'repo')
    const gemfile = tree.children.find((c) => c.id === 'file:Gemfile')
    expect(gemfile).toBeTruthy()
    expect(gemfile!.type).toBe('file')
  })

  it('deduplicates symbols that appear in multiple edges', () => {
    const edges = [
      makeEdge({ id: 1, sourceFile: 'a.rb', sourceSymbol: 'Foo', targetFile: 'b.rb', targetSymbol: 'Bar' }),
      makeEdge({ id: 2, sourceFile: 'a.rb', sourceSymbol: 'Foo', targetFile: 'c.rb', targetSymbol: 'Baz' }),
    ]

    const tree = buildTreeFromEdges(edges, 'repo')
    const fileA = findNode(tree, (n) => n.id === 'file:a.rb')
    expect(fileA).toBeTruthy()
    const fooSymbols = fileA!.children.filter((c) => c.name === 'Foo')
    expect(fooSymbols).toHaveLength(1)
    expect(fooSymbols[0].edgeCount).toBe(2)
  })

  it('returns repo root with zero symbolCount for empty edges', () => {
    const tree = buildTreeFromEdges([], 'repo')
    expect(tree.type).toBe('repo')
    expect(tree.children).toHaveLength(0)
    expect(tree.symbolCount).toBe(0)
  })
})
