import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatMessages } from '@/components/chat/chat-messages'
import type { UIMessage } from 'ai'

vi.mock('@/components/chat/message-part-renderer', () => ({
  MessagePartRenderer: ({ part }: { part: { type: string; text?: string } }) => <span>{part.text ?? ''}</span>,
}))

vi.mock('@/components/chat/confidence-badge', () => ({
  ConfidenceBadge: () => null,
}))

vi.mock('@/components/chat/feedback-buttons', () => ({
  FeedbackButtons: () => null,
}))

describe('Accessibility', () => {
  it('chat message area has role="log" and aria-live="polite"', () => {
    const messages: UIMessage[] = [{
      id: '1', role: 'user', content: 'hello',
      parts: [{ type: 'text', text: 'hello' }],
      createdAt: new Date(),
    }]
    render(<ChatMessages messages={messages} status="ready" />)
    const logRegion = screen.getByRole('log')
    expect(logRegion).toBeDefined()
    expect(logRegion.getAttribute('aria-live')).toBe('polite')
  })

  it('streaming status is announced via aria-live="assertive"', () => {
    const messages: UIMessage[] = []
    const { container } = render(<ChatMessages messages={messages} status="streaming" />)
    const srOnly = container.querySelector('[aria-live="assertive"]')
    expect(srOnly).toBeDefined()
    expect(srOnly!.textContent).toBe('Assistant is responding...')
  })

  it('streaming status clears when not streaming', () => {
    const messages: UIMessage[] = []
    const { container } = render(<ChatMessages messages={messages} status="ready" />)
    const srOnly = container.querySelector('[aria-live="assertive"]')
    expect(srOnly!.textContent).toBe('')
  })
})
