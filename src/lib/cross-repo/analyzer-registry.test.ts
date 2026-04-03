// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { AnalyzerRegistry } from './analyzer-registry'
import type { CrossRepoAnalyzer, CrossRepoEdge } from './types'

function makeEdge(overrides: Partial<CrossRepoEdge> = {}): CrossRepoEdge {
  return {
    sourceRepoId: 'repo-1',
    sourceFile: 'src/index.ts',
    sourceSymbol: 'MyClass',
    targetRepoId: 'repo-2',
    targetFile: 'src/lib.ts',
    targetSymbol: 'Dependency',
    relationshipType: 'npm_dependency',
    metadata: {},
    confidence: 0.9,
    ...overrides,
  }
}

function makeAnalyzer(name: string, edges: CrossRepoEdge[]): CrossRepoAnalyzer {
  return {
    name,
    analyze: vi.fn(async () => edges),
  }
}

describe('AnalyzerRegistry', () => {
  it('registers analyzers by name', () => {
    const registry = new AnalyzerRegistry()
    const analyzer = makeAnalyzer('test', [])
    registry.register(analyzer)
    expect(registry.getAll()).toEqual([analyzer])
  })

  it('runs all registered analyzers and collects results', async () => {
    const registry = new AnalyzerRegistry()
    const edge1 = makeEdge({ sourceSymbol: 'A' })
    const edge2 = makeEdge({ sourceSymbol: 'B', relationshipType: 'gem_dependency' })
    registry.register(makeAnalyzer('analyzer-1', [edge1]))
    registry.register(makeAnalyzer('analyzer-2', [edge2]))

    const results = await registry.runAll([], null as never, null as never)
    expect(results).toHaveLength(2)
    expect(results[0].sourceSymbol).toBe('A')
    expect(results[1].sourceSymbol).toBe('B')
  })

  it('handles analyzer failure gracefully (skips failed, runs rest)', async () => {
    const registry = new AnalyzerRegistry()
    const failingAnalyzer: CrossRepoAnalyzer = {
      name: 'failing',
      analyze: vi.fn(async () => { throw new Error('boom') }),
    }
    const edge = makeEdge()
    registry.register(failingAnalyzer)
    registry.register(makeAnalyzer('working', [edge]))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const results = await registry.runAll([], null as never, null as never)

    expect(results).toHaveLength(1)
    expect(results[0]).toEqual(edge)
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('failing'),
      expect.any(Error),
    )
    consoleSpy.mockRestore()
  })

  it('returns empty array when no analyzers registered', async () => {
    const registry = new AnalyzerRegistry()
    const results = await registry.runAll([], null as never, null as never)
    expect(results).toEqual([])
  })

  it('CrossRepoEdge type includes all required fields', () => {
    const edge = makeEdge()
    expect(edge.sourceRepoId).toBeDefined()
    expect(edge.targetRepoId).toBeDefined()
    expect(edge.sourceFile).toBeDefined()
    expect(edge.sourceSymbol).toBeDefined()
    expect(edge.targetSymbol).toBeDefined()
    expect(edge.relationshipType).toBeDefined()
    expect(edge.metadata).toBeDefined()
    expect(typeof edge.confidence).toBe('number')
    expect(edge.confidence).toBeGreaterThanOrEqual(0)
    expect(edge.confidence).toBeLessThanOrEqual(1)
  })
})
