import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddRepoDialog } from './add-repo-dialog';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';

vi.mock('./github-repo-picker', () => ({
  GitHubRepoPicker: ({ onSelect }: { onSelect: (name: string) => void }) => (
    <button data-testid="github-picker" onClick={() => onSelect('gh/repo')}>
      Pick GitHub
    </button>
  ),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>
      {children}
    </SWRConfig>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('AddRepoDialog', () => {
  it('dialog opens when trigger button is clicked', async () => {
    const user = userEvent.setup();
    render(<AddRepoDialog onAdd={vi.fn().mockResolvedValue(undefined)} />, { wrapper: Wrapper });

    await user.click(screen.getByText('Add Repository'));
    expect(screen.getByText('GitHub')).toBeInTheDocument();
  });

  it('renders two tabs: GitHub and Manual', async () => {
    const user = userEvent.setup();
    render(<AddRepoDialog onAdd={vi.fn().mockResolvedValue(undefined)} />, { wrapper: Wrapper });

    await user.click(screen.getByText('Add Repository'));
    expect(screen.getByRole('tab', { name: 'GitHub' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Manual' })).toBeInTheDocument();
  });

  it('GitHub tab is active by default', async () => {
    const user = userEvent.setup();
    render(<AddRepoDialog onAdd={vi.fn().mockResolvedValue(undefined)} />, { wrapper: Wrapper });

    await user.click(screen.getByText('Add Repository'));
    expect(screen.getByTestId('github-picker')).toBeInTheDocument();
  });

  it('Manual tab renders text input for owner/repo', async () => {
    const user = userEvent.setup();
    render(<AddRepoDialog onAdd={vi.fn().mockResolvedValue(undefined)} />, { wrapper: Wrapper });

    await user.click(screen.getByText('Add Repository'));
    await user.click(screen.getByRole('tab', { name: 'Manual' }));
    expect(screen.getByPlaceholderText('owner/repo')).toBeInTheDocument();
  });

  it('Manual tab validates owner/repo format', async () => {
    const user = userEvent.setup();
    render(<AddRepoDialog onAdd={vi.fn().mockResolvedValue(undefined)} />, { wrapper: Wrapper });

    await user.click(screen.getByText('Add Repository'));
    await user.click(screen.getByRole('tab', { name: 'Manual' }));

    const input = screen.getByPlaceholderText('owner/repo');
    await user.type(input, 'invalid');
    await user.tab();
    expect(screen.getByText(/Invalid format/)).toBeInTheDocument();
  });

  it('adding a repo via manual tab calls onAdd with fullName', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<AddRepoDialog onAdd={onAdd} />, { wrapper: Wrapper });

    await user.click(screen.getByText('Add Repository'));
    await user.click(screen.getByRole('tab', { name: 'Manual' }));

    const input = screen.getByPlaceholderText('owner/repo');
    await user.type(input, 'facebook/react');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(onAdd).toHaveBeenCalledWith('facebook/react');
  });

  it('dialog closes after successful add', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<AddRepoDialog onAdd={onAdd} />, { wrapper: Wrapper });

    await user.click(screen.getByText('Add Repository'));
    await user.click(screen.getByTestId('github-picker'));

    expect(onAdd).toHaveBeenCalledWith('gh/repo');
  });

  it('success toast is shown after adding a repo', async () => {
    const user = userEvent.setup();
    const { toast } = await import('sonner');
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<AddRepoDialog onAdd={onAdd} />, { wrapper: Wrapper });

    await user.click(screen.getByText('Add Repository'));
    await user.click(screen.getByTestId('github-picker'));

    expect(toast.success).toHaveBeenCalledWith('Repository added');
  });
});
