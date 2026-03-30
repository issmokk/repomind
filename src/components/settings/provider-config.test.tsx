import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProviderConfig } from './provider-config'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('ProviderConfig', () => {
  it('API key field shows masked value from API', () => {
    render(
      <ProviderConfig
        provider="claude"
        config={{ claudeApiKey: '****XXXX', claudeModel: 'claude-sonnet-4.6' }}
        onChange={vi.fn()}
        dirtyFields={new Set()}
      />,
    )
    const input = screen.getByTestId('input-claudeApiKey') as HTMLInputElement
    expect(input.value).toBe('****XXXX')
  })

  it('editing API key field marks as dirty', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <ProviderConfig
        provider="claude"
        config={{ claudeApiKey: '****XXXX', claudeModel: '' }}
        onChange={onChange}
        dirtyFields={new Set()}
      />,
    )
    const input = screen.getByTestId('input-claudeApiKey')
    await user.clear(input)
    await user.type(input, 'sk-new-key')
    expect(onChange).toHaveBeenCalledWith('claudeApiKey', expect.any(String))
  })

  it('test connection button calls backend and shows result', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      json: async () => ({ success: true, message: 'Connected' }),
    } as Response)

    render(
      <ProviderConfig
        provider="claude"
        config={{ claudeApiKey: 'sk-test' }}
        onChange={vi.fn()}
        dirtyFields={new Set()}
      />,
    )
    await user.click(screen.getByText('Test Connection'))
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeDefined()
    })
  })

  it('unchanged masked value is not sent when config unchanged', () => {
    const onChange = vi.fn()
    render(
      <ProviderConfig
        provider="claude"
        config={{ claudeApiKey: '****XXXX', claudeModel: 'model' }}
        onChange={onChange}
        dirtyFields={new Set()}
      />,
    )
    expect(onChange).not.toHaveBeenCalled()
  })
})
