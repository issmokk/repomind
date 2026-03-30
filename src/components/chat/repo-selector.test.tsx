import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepoSelector } from './repo-selector';

const repos = [
  { id: '1', name: 'repo-a', fullName: 'org/repo-a' },
  { id: '2', name: 'repo-b', fullName: 'org/repo-b' },
  { id: '3', name: 'repo-c', fullName: 'org/repo-c' },
];

describe('RepoSelector', () => {
  it('renders selected repos as chips', () => {
    render(<RepoSelector repos={repos} selectedIds={['1', '2']} onSelectionChange={vi.fn()} />);
    expect(screen.getByText('repo-a')).toBeTruthy();
    expect(screen.getByText('repo-b')).toBeTruthy();
  });

  it('shows "All repos" when all selected', () => {
    render(<RepoSelector repos={repos} selectedIds={['1', '2', '3']} onSelectionChange={vi.fn()} />);
    expect(screen.getByText('All repos')).toBeTruthy();
  });

  it('dropdown shows repos when opened', async () => {
    render(<RepoSelector repos={repos} selectedIds={['1']} onSelectionChange={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByText('repo-a').closest('button')!);
    expect(screen.getByText('org/repo-a')).toBeTruthy();
    expect(screen.getByText('org/repo-b')).toBeTruthy();
  });

  it('selecting a repo updates selection', async () => {
    const onChange = vi.fn();
    render(<RepoSelector repos={repos} selectedIds={['1']} onSelectionChange={onChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByText('repo-a').closest('button')!);
    await user.click(screen.getByText('org/repo-b'));
    expect(onChange).toHaveBeenCalledWith(['1', '2']);
  });
});
