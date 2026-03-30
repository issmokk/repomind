import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/hooks/use-graph-visualization', () => ({
  useGraphVisualization: () => ({
    fitToView: vi.fn(),
    highlightNodes: vi.fn(),
    dimNonMatching: vi.fn(),
    runLayout: vi.fn(),
  }),
}))

import { GraphCanvas } from './graph-canvas'
import type { GraphElements } from '@/lib/graph-transforms'

const sampleElements: GraphElements = {
  nodes: [
    { data: { id: 'a.ts:funcA', symbolName: 'funcA', symbolType: 'function', filePath: 'a.ts' } },
    { data: { id: 'b.ts:funcB', symbolName: 'funcB', symbolType: 'function', filePath: 'b.ts' } },
  ],
  edges: [
    { data: { id: '1', source: 'a.ts:funcA', target: 'b.ts:funcB', relationshipType: 'calls' } },
  ],
}

describe('GraphCanvas', () => {
  it('Cytoscape canvas container initializes on mount', () => {
    render(<GraphCanvas elements={sampleElements} isLoading={false} layout="cose" searchQuery="" />)
    expect(screen.getByTestId('graph-canvas')).toBeDefined()
  })

  it('shows GraphSkeleton while loading', () => {
    render(<GraphCanvas elements={undefined} isLoading={true} layout="cose" searchQuery="" />)
    expect(screen.getByTestId('graph-loading')).toBeDefined()
  })

  it('shows empty state when no elements', () => {
    const empty: GraphElements = { nodes: [], edges: [] }
    render(<GraphCanvas elements={empty} isLoading={false} layout="cose" searchQuery="" />)
    expect(screen.getByTestId('graph-empty')).toBeDefined()
  })
})
