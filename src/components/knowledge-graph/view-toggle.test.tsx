import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ViewToggle } from './view-toggle'

describe('ViewToggle', () => {
  it('renders Graph and Tree buttons', () => {
    render(<ViewToggle value="graph" onChange={vi.fn()} />)
    expect(screen.getByTestId('view-toggle-graph')).toBeInTheDocument()
    expect(screen.getByTestId('view-toggle-tree')).toBeInTheDocument()
  })

  it('calls onChange with "tree" when Tree button clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ViewToggle value="graph" onChange={onChange} />)

    await user.click(screen.getByTestId('view-toggle-tree'))
    expect(onChange).toHaveBeenCalledWith('tree')
  })

  it('calls onChange with "graph" when Graph button clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ViewToggle value="tree" onChange={onChange} />)

    await user.click(screen.getByTestId('view-toggle-graph'))
    expect(onChange).toHaveBeenCalledWith('graph')
  })

  it('highlights the active button', () => {
    render(<ViewToggle value="tree" onChange={vi.fn()} />)
    const treeBtn = screen.getByTestId('view-toggle-tree')
    const graphBtn = screen.getByTestId('view-toggle-graph')
    expect(treeBtn.className).toContain('bg-accent')
    expect(graphBtn.className).not.toContain('bg-accent')
  })
})
