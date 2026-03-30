import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SWRConfig } from 'swr'
import React from 'react'
import { RepoSettingsTable } from './repo-settings-table'

const mockRepos = [
  { id: 'r1', fullName: 'org/repo-1', name: 'repo-1', url: '', defaultBranch: 'main' },
  { id: 'r2', fullName: 'org/repo-2', name: 'repo-2', url: '', defaultBranch: 'main' },
]

const mockSettings = {
  id: 's1', repoId: 'r1', branchFilter: ['main'], includePatterns: ['src/**'],
  excludePatterns: ['node_modules/**'], embeddingProvider: 'ollama', embeddingModel: 'gte',
  autoIndexOnAdd: false, createdAt: '', updatedAt: '',
}

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const fetchSpy = vi.fn()

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(SWRConfig, {
    value: {
      dedupingInterval: 0,
      provider: () => new Map(),
      fetcher: () => Promise.resolve(mockRepos),
    },
  }, children)
}

beforeEach(() => {
  vi.restoreAllMocks()
  fetchSpy.mockReset()
  vi.spyOn(globalThis, 'fetch').mockImplementation((...args: Parameters<typeof fetch>) => {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url
    if (url.includes('/settings') && !args[1]?.method) {
      return Promise.resolve({ ok: true, json: async () => mockSettings } as Response)
    }
    if (url.includes('/settings') && args[1]?.method === 'PUT') {
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
    }
    return Promise.resolve({ ok: true, json: async () => mockRepos } as Response)
  })
})

describe('RepoSettingsTable', () => {
  it('renders all repos with their current settings', async () => {
    render(<RepoSettingsTable />, { wrapper })
    await waitFor(() => {
      expect(screen.getByText('org/repo-1')).toBeDefined()
      expect(screen.getByText('org/repo-2')).toBeDefined()
    })
  })

  it('edit button opens settings form for that repo', async () => {
    const user = userEvent.setup()
    render(<RepoSettingsTable />, { wrapper })
    await waitFor(() => expect(screen.getByText('org/repo-1')).toBeDefined())

    const editButtons = screen.getAllByText('Edit')
    await user.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByTestId('repo-edit-form')).toBeDefined()
    })
  })

  it('saving per-repo settings calls PUT', async () => {
    const user = userEvent.setup()
    render(<RepoSettingsTable />, { wrapper })
    await waitFor(() => expect(screen.getByText('org/repo-1')).toBeDefined())

    await user.click(screen.getAllByText('Edit')[0])
    await waitFor(() => expect(screen.getByTestId('repo-edit-form')).toBeDefined())

    await user.click(screen.getByText('Save'))

    await waitFor(() => {
      const calls = vi.mocked(globalThis.fetch).mock.calls
      const putCall = calls.find((c) => {
        const url = typeof c[0] === 'string' ? c[0] : (c[0] as Request).url
        return url.includes('/settings') && c[1]?.method === 'PUT'
      })
      expect(putCall).toBeDefined()
    })
  })
})
