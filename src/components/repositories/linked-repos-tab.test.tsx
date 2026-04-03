import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LinkedReposTab } from './linked-repos-tab'

vi.mock('swr', () => ({
  default: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('./repo-selector', () => ({
  RepoSelector: () => <div data-testid="repo-selector">RepoSelector</div>,
}))

vi.mock('@/components/shared/confirmation-dialog', () => ({
  ConfirmationDialog: () => null,
}))

import useSWR from 'swr'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LinkedReposTab', () => {
  it('shows loading state', () => {
    vi.mocked(useSWR).mockReturnValue({
      data: undefined,
      isLoading: true,
      mutate: vi.fn(),
    } as never)

    render(<LinkedReposTab repoId="repo-1" />)
    expect(screen.getByText(/loading linked repos/i)).toBeDefined()
  })

  it('shows empty state when no link groups exist', () => {
    vi.mocked(useSWR).mockReturnValue({
      data: [],
      isLoading: false,
      mutate: vi.fn(),
    } as never)

    render(<LinkedReposTab repoId="repo-1" />)
    expect(screen.getByText(/no linked repos yet/i)).toBeDefined()
  })

  it('renders link groups with repo badges', () => {
    vi.mocked(useSWR).mockReturnValue({
      data: [
        {
          id: 'link-1',
          orgId: 'org-1',
          name: 'Payment Services',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
          memberships: [],
          repos: [
            { id: 'repo-1', name: 'wt_payment', fullName: 'org/wt_payment' },
            { id: 'repo-2', name: 'wt_booking', fullName: 'org/wt_booking' },
          ],
        },
      ],
      isLoading: false,
      mutate: vi.fn(),
    } as never)

    render(<LinkedReposTab repoId="repo-1" />)
    expect(screen.getByText('Payment Services')).toBeDefined()
    expect(screen.getByText('wt_payment')).toBeDefined()
    expect(screen.getByText('wt_booking')).toBeDefined()
    expect(screen.getByText('2 repos')).toBeDefined()
  })

  it('has Create Link Group button', () => {
    vi.mocked(useSWR).mockReturnValue({
      data: [],
      isLoading: false,
      mutate: vi.fn(),
    } as never)

    render(<LinkedReposTab repoId="repo-1" />)
    expect(screen.getByText(/create link group/i)).toBeDefined()
  })

  it('has Analyze button on each link group', () => {
    vi.mocked(useSWR).mockReturnValue({
      data: [
        {
          id: 'link-1', orgId: 'org-1', name: 'Test',
          createdAt: '2024-01-01', updatedAt: '2024-01-01',
          memberships: [],
          repos: [{ id: 'repo-1', name: 'repo1', fullName: 'org/repo1' }],
        },
      ],
      isLoading: false,
      mutate: vi.fn(),
    } as never)

    render(<LinkedReposTab repoId="repo-1" />)
    expect(screen.getByText('Analyze')).toBeDefined()
  })
})
