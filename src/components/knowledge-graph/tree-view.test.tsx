import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TreeView } from './tree-view'
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
    confidence: null,
    createdAt: '2024-01-01',
    ...overrides,
  }
}

// Mock the virtualizer to render all items (jsdom has no scroll container dimensions)
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 28,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 28,
        size: 28,
        key: i,
      })),
  }),
}))

const sampleEdges: GraphEdge[] = [
  makeEdge({
    id: 1,
    sourceFile: 'src/actions/pay.rb',
    sourceSymbol: 'PayAction',
    sourceType: 'class',
    targetFile: 'src/models/payment.rb',
    targetSymbol: 'Payment',
    targetType: 'class',
  }),
]

describe('TreeView', () => {
  it('renders repo as root node', () => {
    render(<TreeView edges={sampleEdges} repoName="my-repo" selectedNodeId={null} onSelect={vi.fn()} />)
    expect(screen.getByTestId('tree-node-repo:my-repo')).toBeInTheDocument()
    expect(screen.getByText('my-repo')).toBeInTheDocument()
  })

  it('expands/collapses nodes on click', async () => {
    const user = userEvent.setup()
    render(<TreeView edges={sampleEdges} repoName="my-repo" selectedNodeId={null} onSelect={vi.fn()} />)

    // Root is expanded by default, so src dir should be visible
    expect(screen.getByTestId('tree-node-dir:src')).toBeInTheDocument()

    // Click root to collapse
    await user.click(screen.getByTestId('tree-node-repo:my-repo'))

    // src dir should be gone
    expect(screen.queryByTestId('tree-node-dir:src')).not.toBeInTheDocument()

    // Click root again to expand
    await user.click(screen.getByTestId('tree-node-repo:my-repo'))
    expect(screen.getByTestId('tree-node-dir:src')).toBeInTheDocument()
  })

  it('shows dependency counts at each level', () => {
    const edges: GraphEdge[] = [
      makeEdge({ id: 1, sourceFile: 'a.rb', sourceSymbol: 'Foo', targetFile: 'b.rb', targetSymbol: 'Bar' }),
      makeEdge({ id: 2, sourceFile: 'a.rb', sourceSymbol: 'Foo', targetFile: 'c.rb', targetSymbol: 'Baz' }),
    ]
    render(<TreeView edges={edges} repoName="repo" selectedNodeId={null} onSelect={vi.fn()} />)

    // The repo root should show a deps count
    const root = screen.getByTestId('tree-node-repo:repo')
    expect(root.textContent).toMatch(/dep/)
  })

  it('calls onSelect when a node is clicked', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()

    // Use root-level files so they're visible when root is expanded
    const edges: GraphEdge[] = [
      makeEdge({ sourceFile: 'app.rb', sourceSymbol: 'App', targetFile: 'lib.rb', targetSymbol: 'Lib' }),
    ]
    render(<TreeView edges={edges} repoName="repo" selectedNodeId={null} onSelect={onSelect} />)

    const fileNode = screen.getByTestId('tree-node-file:app.rb')
    await user.click(fileNode)
    expect(onSelect).toHaveBeenCalledWith('file:app.rb')
  })

  it('shows empty state when no edges', () => {
    render(<TreeView edges={[]} repoName="repo" selectedNodeId={null} onSelect={vi.fn()} />)
    expect(screen.getByTestId('tree-empty')).toBeInTheDocument()
    expect(screen.getByText('No tree data')).toBeInTheDocument()
  })
})
