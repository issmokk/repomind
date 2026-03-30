import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchConfig } from './search-config'

describe('SearchConfig', () => {
  it('max graph hops slider renders with correct range', () => {
    render(<SearchConfig maxGraphHops={2} searchTopK={10} searchRrfK={60} onChange={vi.fn()} />)
    const slider = screen.getByLabelText('Max graph hops') as HTMLInputElement
    expect(slider.min).toBe('0')
    expect(slider.max).toBe('5')
    expect(slider.value).toBe('2')
  })

  it('search top-K slider renders with correct range', () => {
    render(<SearchConfig maxGraphHops={2} searchTopK={10} searchRrfK={60} onChange={vi.fn()} />)
    const slider = screen.getByLabelText('Search top K') as HTMLInputElement
    expect(slider.min).toBe('1')
    expect(slider.max).toBe('50')
    expect(slider.value).toBe('10')
  })

  it('changing value calls onChange', () => {
    const onChange = vi.fn()
    render(<SearchConfig maxGraphHops={2} searchTopK={10} searchRrfK={60} onChange={onChange} />)
    const slider = screen.getByLabelText('Max graph hops')
    fireEvent.change(slider, { target: { value: '4' } })
    expect(onChange).toHaveBeenCalledWith('maxGraphHops', 4)
  })
})
