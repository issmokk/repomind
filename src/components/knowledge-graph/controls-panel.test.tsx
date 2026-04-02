import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ControlsPanel, type ControlsPanelProps } from './controls-panel'

const defaultProps: ControlsPanelProps = {
  repos: [
    { id: 'r1', fullName: 'org/repo-1' },
    { id: 'r2', fullName: 'org/repo-2' },
  ],
  layout: 'cose',
  onLayoutChange: vi.fn(),
  filters: {},
  onFilterChange: vi.fn(),
  onSearch: vi.fn(),
  showCrossRepo: false,
  onShowCrossRepoChange: vi.fn(),
  confidenceThreshold: 0,
  onConfidenceThresholdChange: vi.fn(),
  hasCrossRepoData: false,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ControlsPanel', () => {
  it('layout dropdown renders all options', async () => {
    const user = userEvent.setup()
    render(<ControlsPanel {...defaultProps} />)

    const trigger = screen.getByTestId('layout-select')
    await user.click(trigger)

    expect(screen.getByText('Force-directed')).toBeDefined()
    expect(screen.getByText('Hierarchical')).toBeDefined()
    expect(screen.getByText('Circular')).toBeDefined()
    expect(screen.getByText('Breadthfirst')).toBeDefined()
  })

  it('changing layout calls onLayoutChange', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const onLayoutChange = vi.fn()
    render(<ControlsPanel {...defaultProps} onLayoutChange={onLayoutChange} />)

    const trigger = screen.getByTestId('layout-select')
    await user.click(trigger)
    await user.click(screen.getByText('Hierarchical'))

    expect(onLayoutChange).toHaveBeenCalledWith('dagre')
  })

  it('repo filter checkboxes toggle visibility', async () => {
    const user = userEvent.setup()
    const onFilterChange = vi.fn()
    render(<ControlsPanel {...defaultProps} onFilterChange={onFilterChange} />)

    const repoCheckbox = screen.getByText('org/repo-1').closest('label')!.querySelector('[data-slot="checkbox"]')!
    await user.click(repoCheckbox)

    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({
      repoIds: ['r2'],
    }))
  })

  it('node type filter checkboxes toggle visibility', async () => {
    const user = userEvent.setup()
    const onFilterChange = vi.fn()
    render(<ControlsPanel {...defaultProps} onFilterChange={onFilterChange} />)

    const classCheckbox = screen.getByText('class').closest('label')!.querySelector('[data-slot="checkbox"]')!
    await user.click(classCheckbox)

    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({
      symbolTypes: expect.not.arrayContaining(['class']),
    }))
  })

  it('relationship type filter checkboxes toggle', async () => {
    const user = userEvent.setup()
    const onFilterChange = vi.fn()
    render(<ControlsPanel {...defaultProps} onFilterChange={onFilterChange} />)

    const importsCheckbox = screen.getByText('imports').closest('label')!.querySelector('[data-slot="checkbox"]')!
    await user.click(importsCheckbox)

    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({
      relationshipTypes: expect.not.arrayContaining(['imports']),
    }))
  })

  it('search input calls onSearch with debounced value', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    render(<ControlsPanel {...defaultProps} onSearch={onSearch} />)

    const searchInput = screen.getByTestId('graph-search')
    await user.type(searchInput, 'MyClass')

    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('MyClass')
    }, { timeout: 500 })
  })
})
