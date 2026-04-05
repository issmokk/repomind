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

const defaultProps = {
  onAdd: vi.fn().mockResolvedValue('repo-123'),
  onTriggerIndex: vi.fn().mockResolvedValue(undefined),
};

beforeEach(() => {
  vi.restoreAllMocks();
  defaultProps.onAdd = vi.fn().mockResolvedValue('repo-123');
  defaultProps.onTriggerIndex = vi.fn().mockResolvedValue(undefined);
});

describe('AddRepoDialog', () => {
  it('dialog opens when trigger button is clicked', async () => {
    const user = userEvent.setup();
    render(<AddRepoDialog {...defaultProps} />, { wrapper: Wrapper });

    await user.click(screen.getByText('Add Repository'));
    expect(screen.getByText('GitHub')).toBeInTheDocument();
  });

  it('renders two tabs: GitHub and Manual', async () => {
    const user = userEvent.setup();
    render(<AddRepoDialog {...defaultProps} />, { wrapper: Wrapper });

    await user.click(screen.getByText('Add Repository'));
    expect(screen.getByRole('tab', { name: 'GitHub' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Manual' })).toBeInTheDocument();
  });

  it('GitHub tab is active by default', async () => {
    const user = userEvent.setup();
    render(<AddRepoDialog {...defaultProps} />, { wrapper: Wrapper });

    await user.click(screen.getByText('Add Repository'));
    expect(screen.getByTestId('github-picker')).toBeInTheDocument();
  });

  it('Manual tab renders text input for owner/repo', async () => {
    const user = userEvent.setup();
    render(<AddRepoDialog {...defaultProps} />, { wrapper: Wrapper });

    await user.click(screen.getByText('Add Repository'));
    await user.click(screen.getByRole('tab', { name: 'Manual' }));
    expect(screen.getByPlaceholderText('owner/repo')).toBeInTheDocument();
  });

  it('Manual tab validates owner/repo format', async () => {
    const user = userEvent.setup();
    render(<AddRepoDialog {...defaultProps} />, { wrapper: Wrapper });

    await user.click(screen.getByText('Add Repository'));
    await user.click(screen.getByRole('tab', { name: 'Manual' }));

    const input = screen.getByPlaceholderText('owner/repo');
    await user.type(input, 'invalid');
    await user.tab();
    expect(screen.getByText(/Invalid format/)).toBeInTheDocument();
  });

  it('adding a repo via manual tab calls onAdd with fullName', async () => {
    const user = userEvent.setup();
    render(<AddRepoDialog {...defaultProps} />, { wrapper: Wrapper });

    await user.click(screen.getByText('Add Repository'));
    await user.click(screen.getByRole('tab', { name: 'Manual' }));

    const input = screen.getByPlaceholderText('owner/repo');
    await user.type(input, 'facebook/react');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(defaultProps.onAdd).toHaveBeenCalledWith('facebook/react');
  });

  it('dialog closes after successful add', async () => {
    const user = userEvent.setup();
    render(<AddRepoDialog {...defaultProps} />, { wrapper: Wrapper });

    await user.click(screen.getByText('Add Repository'));
    await user.click(screen.getByTestId('github-picker'));

    expect(defaultProps.onAdd).toHaveBeenCalledWith('gh/repo');
  });

  it('shows "Start indexing immediately" checkbox, checked by default', async () => {
    const user = userEvent.setup();
    render(<AddRepoDialog {...defaultProps} />, { wrapper: Wrapper });

    await user.click(screen.getByText('Add Repository'));
    expect(screen.getByText('Start indexing immediately')).toBeInTheDocument();
    const checkbox = screen.getByRole('checkbox', { name: 'Start indexing immediately' });
    expect(checkbox).toHaveAttribute('data-checked', '');
  });

  it('triggers indexing after adding when checkbox is checked', async () => {
    const user = userEvent.setup();
    const { toast } = await import('sonner');
    render(<AddRepoDialog {...defaultProps} />, { wrapper: Wrapper });

    await user.click(screen.getByText('Add Repository'));
    await user.click(screen.getByTestId('github-picker'));

    expect(defaultProps.onTriggerIndex).toHaveBeenCalledWith('repo-123');
    expect(toast.success).toHaveBeenCalledWith('Repository added. Indexing started.');
  });

  it('does not trigger indexing when checkbox is unchecked', async () => {
    const user = userEvent.setup();
    const { toast } = await import('sonner');
    render(<AddRepoDialog {...defaultProps} />, { wrapper: Wrapper });

    await user.click(screen.getByText('Add Repository'));
    await user.click(screen.getByRole('checkbox', { name: 'Start indexing immediately' }));
    await user.click(screen.getByTestId('github-picker'));

    expect(defaultProps.onTriggerIndex).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Repository added');
  });

  it('shows warning toast if indexing fails to start', async () => {
    const user = userEvent.setup();
    const { toast } = await import('sonner');
    defaultProps.onTriggerIndex = vi.fn().mockRejectedValue(new Error('fail'));
    render(<AddRepoDialog {...defaultProps} />, { wrapper: Wrapper });

    await user.click(screen.getByText('Add Repository'));
    await user.click(screen.getByTestId('github-picker'));

    expect(toast.success).toHaveBeenCalledWith(
      'Repository added, but indexing failed to start. You can trigger it manually.',
    );
  });
});
