import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GraphFiltersPanel } from './graph-filters'

describe('GraphFiltersPanel', () => {
  const defaultProps = {
    showCrossRepo: true,
    onShowCrossRepoChange: vi.fn(),
    confidenceThreshold: 0,
    onConfidenceThresholdChange: vi.fn(),
    hasCrossRepoData: true,
  }

  it('cross-repo filter toggle calls onChange', () => {
    const onShowCrossRepoChange = vi.fn()
    render(<GraphFiltersPanel {...defaultProps} onShowCrossRepoChange={onShowCrossRepoChange} />)
    const toggle = screen.getByTestId('cross-repo-toggle')
    fireEvent.click(toggle)
    expect(onShowCrossRepoChange).toHaveBeenCalledWith(false)
  })

  it('confidence threshold slider is visible when cross-repo enabled', () => {
    render(<GraphFiltersPanel {...defaultProps} />)
    const slider = screen.getByTestId('confidence-slider')
    expect(slider).toBeInTheDocument()
  })

  it('confidence slider hidden when cross-repo disabled', () => {
    render(<GraphFiltersPanel {...defaultProps} showCrossRepo={false} />)
    expect(screen.queryByTestId('confidence-slider')).not.toBeInTheDocument()
  })

  it('cross-repo toggle disabled with message when no cross-repo data', () => {
    render(<GraphFiltersPanel {...defaultProps} hasCrossRepoData={false} />)
    const toggle = screen.getByTestId('cross-repo-toggle')
    expect(toggle).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText(/run cross-repo analysis/i)).toBeInTheDocument()
  })
})
