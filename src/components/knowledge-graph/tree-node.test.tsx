import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TreeNode } from './tree-node'
import type { TreeNodeData } from '@/hooks/use-tree-data'

const sampleNode: TreeNodeData = {
  id: 'dir:src',
  name: 'src',
  type: 'directory',
  filePath: 'src',
  children: [
    {
      id: 'file:src/app.rb',
      name: 'app.rb',
      type: 'file',
      filePath: 'src/app.rb',
      children: [],
      symbolCount: 1,
      edgeCount: 3,
    },
  ],
  symbolCount: 1,
  edgeCount: 3,
}

describe('TreeNode', () => {
  it('renders node name and icon', () => {
    render(
      <TreeNode
        node={sampleNode}
        depth={0}
        expandedIds={new Set()}
        selectedId={null}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByText('src')).toBeInTheDocument()
  })

  it('shows edge count badge', () => {
    render(
      <TreeNode
        node={sampleNode}
        depth={0}
        expandedIds={new Set()}
        selectedId={null}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByText('3 deps')).toBeInTheDocument()
  })

  it('calls onToggle and onSelect on click', async () => {
    const onToggle = vi.fn()
    const onSelect = vi.fn()
    const user = userEvent.setup()

    render(
      <TreeNode
        node={sampleNode}
        depth={0}
        expandedIds={new Set()}
        selectedId={null}
        onToggle={onToggle}
        onSelect={onSelect}
      />,
    )

    await user.click(screen.getByTestId('tree-node-dir:src'))
    expect(onToggle).toHaveBeenCalledWith('dir:src')
    expect(onSelect).toHaveBeenCalledWith('dir:src')
  })

  it('shows selected state when selectedId matches', () => {
    render(
      <TreeNode
        node={sampleNode}
        depth={0}
        expandedIds={new Set()}
        selectedId="dir:src"
        onToggle={vi.fn()}
        onSelect={vi.fn()}
      />,
    )
    const btn = screen.getByTestId('tree-node-dir:src')
    expect(btn.className).toContain('bg-accent')
  })

  it('does not call onToggle for leaf nodes', async () => {
    const leafNode: TreeNodeData = {
      id: 'src/app.rb:Foo',
      name: 'Foo',
      type: 'class',
      filePath: 'src/app.rb',
      children: [],
      symbolCount: 0,
      edgeCount: 2,
    }
    const onToggle = vi.fn()
    const onSelect = vi.fn()
    const user = userEvent.setup()

    render(
      <TreeNode
        node={leafNode}
        depth={2}
        expandedIds={new Set()}
        selectedId={null}
        onToggle={onToggle}
        onSelect={onSelect}
      />,
    )

    await user.click(screen.getByTestId(`tree-node-${leafNode.id}`))
    expect(onToggle).not.toHaveBeenCalled()
    expect(onSelect).toHaveBeenCalledWith(leafNode.id)
  })
})
