import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import React from 'react'
import type { GraphEdge } from '@/types/graph'

const sampleEdges: GraphEdge[] = [
  {
    id: 1, repoId: 'repo-1', sourceFile: 'a.ts', sourceSymbol: 'funcA', sourceType: 'function',
    targetFile: 'b.ts', targetSymbol: 'funcB', targetType: 'function',
    relationshipType: 'calls', metadata: {}, createdAt: '2025-01-01',
  },
  {
    id: 2, repoId: 'repo-1', sourceFile: 'a.ts', sourceSymbol: 'funcA', sourceType: 'function',
    targetFile: 'c.ts', targetSymbol: 'ClassC', targetType: 'class',
    relationshipType: 'imports', metadata: {}, createdAt: '2025-01-01',
  },
]

const mockFetcher = vi.fn()

vi.mock('@/lib/fetcher', () => ({
  fetcher: (...args: unknown[]) => mockFetcher(...args),
  FetchError: class extends Error { status: number; constructor(s: number, m: string) { super(m); this.status = s } },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(SWRConfig, { value: { dedupingInterval: 0, provider: () => new Map() } }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetcher.mockResolvedValue({
    edges: sampleEdges,
    nodeCount: 3,
    edgeCount: 2,
    hasMore: false,
  })
})

describe('useGraphData', () => {
  it('transforms edges into Cytoscape elements format', async () => {
    const { useGraphData } = await import('./use-graph-data')
    const { result } = renderHook(() => useGraphData({}), { wrapper })

    await waitFor(() => expect(result.current.elements).toBeDefined())

    expect(result.current.elements!.nodes.length).toBe(3)
    expect(result.current.elements!.edges.length).toBe(2)
  })

  it('deduplicates nodes from edge endpoints', async () => {
    const { useGraphData } = await import('./use-graph-data')
    const { result } = renderHook(() => useGraphData({}), { wrapper })

    await waitFor(() => expect(result.current.elements).toBeDefined())

    const nodeIds = result.current.elements!.nodes.map((n) => n.data.id)
    expect(new Set(nodeIds).size).toBe(nodeIds.length)
  })

  it('refetches when filters change', async () => {
    const { useGraphData } = await import('./use-graph-data')
    const { result, rerender } = renderHook(
      ({ filters }) => useGraphData(filters),
      { wrapper, initialProps: { filters: {} } },
    )

    await waitFor(() => expect(result.current.elements).toBeDefined())
    const callCount = mockFetcher.mock.calls.length

    rerender({ filters: { repoIds: ['repo-1'] } })
    await waitFor(() => expect(mockFetcher.mock.calls.length).toBeGreaterThan(callCount))
  })

  it('returns loading state while fetching', async () => {
    mockFetcher.mockReturnValue(new Promise(() => {}))
    const { useGraphData } = await import('./use-graph-data')
    const { result } = renderHook(() => useGraphData({}), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.elements).toBeUndefined()
  })

  it('returns error state on fetch failure', async () => {
    mockFetcher.mockRejectedValue(new Error('Network error'))
    const { useGraphData } = await import('./use-graph-data')
    const { result } = renderHook(() => useGraphData({}), { wrapper })

    await waitFor(() => expect(result.current.error).toBeDefined())
  })
})
