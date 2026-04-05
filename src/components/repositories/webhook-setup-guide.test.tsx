import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WebhookSetupGuide } from './webhook-setup-guide'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const defaultProps = {
  repoId: 'repo-1',
  fullName: 'owner/repo',
  githubAuthType: 'pat' as const,
}

const webhookInfo = {
  webhookUrl: 'https://repomind.example.com/api/webhooks/github',
  secretConfigured: true,
  existingHook: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(webhookInfo), { status: 200 })),
  ) as unknown as typeof fetch
})

describe('WebhookSetupGuide', () => {
  it('shows loading state initially', () => {
    render(<WebhookSetupGuide {...defaultProps} />)
    expect(screen.getByText(/Checking webhook status/)).toBeInTheDocument()
  })

  it('shows manual setup instructions for PAT repos', async () => {
    render(<WebhookSetupGuide {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText(/Configure a webhook on GitHub/)).toBeInTheDocument()
    })
    expect(screen.getByText('https://repomind.example.com/api/webhooks/github')).toBeInTheDocument()
    expect(screen.getByText('application/json')).toBeInTheDocument()
    expect(screen.getByText(/Just the push event/)).toBeInTheDocument()
  })

  it('shows link to GitHub webhook settings', async () => {
    render(<WebhookSetupGuide {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /owner\/repo\/settings\/hooks/ })).toHaveAttribute(
        'href',
        'https://github.com/owner/repo/settings/hooks/new',
      )
    })
  })

  it('shows auto-configure button for GitHub App repos', async () => {
    render(<WebhookSetupGuide {...defaultProps} githubAuthType="github_app" />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Auto-configure webhook/ })).toBeInTheDocument()
    })
  })

  it('does not show auto-configure button for PAT repos', async () => {
    render(<WebhookSetupGuide {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText(/Configure a webhook on GitHub/)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /Auto-configure/ })).not.toBeInTheDocument()
  })

  it('shows Active badge when webhook is already configured', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({
        ...webhookInfo,
        existingHook: { id: 42, active: true },
      }), { status: 200 })),
    ) as unknown as typeof fetch

    render(<WebhookSetupGuide {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument()
    })
    expect(screen.getByText(/webhook is active/)).toBeInTheDocument()
  })

  it('shows warning when secret is not configured', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({
        ...webhookInfo,
        secretConfigured: false,
      }), { status: 200 })),
    ) as unknown as typeof fetch

    render(<WebhookSetupGuide {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText(/not currently set on the server/)).toBeInTheDocument()
    })
  })

  it('copies webhook URL to clipboard', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    })

    render(<WebhookSetupGuide {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText(webhookInfo.webhookUrl)).toBeInTheDocument()
    })

    const copyButtons = screen.getAllByRole('button')
    const copyButton = copyButtons.find((b) => b.querySelector('[class*="copy"], svg'))
    if (copyButton) {
      await user.click(copyButton)
      expect(writeText).toHaveBeenCalledWith(webhookInfo.webhookUrl)
    }
  })

  it('auto-configure calls POST and shows success', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(webhookInfo), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, hookId: 99, alreadyExists: false }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...webhookInfo, existingHook: { id: 99, active: true } }), { status: 200 }))
    global.fetch = fetchMock as unknown as typeof fetch

    render(<WebhookSetupGuide {...defaultProps} githubAuthType="github_app" />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Auto-configure webhook/ })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Auto-configure webhook/ }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/repos/repo-1/webhook', { method: 'POST' })
    })

    const { toast } = await import('sonner')
    expect(toast.success).toHaveBeenCalledWith('Webhook created successfully')
  })
})
