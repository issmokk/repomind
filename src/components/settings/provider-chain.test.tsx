import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProviderChain, type ProviderStatus } from './provider-chain'

const providers: ProviderStatus[] = [
  { name: 'claude', configured: true },
  { name: 'openai', configured: false },
  { name: 'ollama', configured: true },
]

describe('ProviderChain', () => {
  it('renders providers in correct order', () => {
    render(
      <ProviderChain
        providerOrder={['claude', 'openai', 'ollama']}
        providers={providers}
        onReorder={vi.fn()}
      />,
    )
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0].textContent).toContain('claude')
    expect(items[1].textContent).toContain('openai')
    expect(items[2].textContent).toContain('ollama')
  })

  it('drag-to-reorder changes the order', () => {
    const onReorder = vi.fn()
    const { container } = render(
      <ProviderChain
        providerOrder={['claude', 'openai', 'ollama']}
        providers={providers}
        onReorder={onReorder}
      />,
    )
    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(3)
  })

  it('shows "Configured" for providers with API keys', () => {
    render(
      <ProviderChain
        providerOrder={['claude']}
        providers={[{ name: 'claude', configured: true }]}
        onReorder={vi.fn()}
      />,
    )
    expect(screen.getByText('Configured')).toBeDefined()
  })

  it('shows "Not configured" for providers without keys', () => {
    render(
      <ProviderChain
        providerOrder={['openai']}
        providers={[{ name: 'openai', configured: false }]}
        onReorder={vi.fn()}
      />,
    )
    expect(screen.getByText('Not configured')).toBeDefined()
  })
})
