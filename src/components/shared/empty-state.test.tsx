import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from './empty-state';
import { FolderOpen } from 'lucide-react';

describe('EmptyState', () => {
  it('renders heading, description, and icon', () => {
    render(
      <EmptyState
        icon={FolderOpen}
        heading="No repositories"
        description="Add your first repository to get started."
      />,
    );
    expect(screen.getByText('No repositories')).toBeTruthy();
    expect(screen.getByText('Add your first repository to get started.')).toBeTruthy();
  });

  it('renders CTA button when action provided', () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={FolderOpen}
        heading="No repos"
        description="Add one."
        action={{ label: 'Add Repository', onClick }}
      />,
    );
    expect(screen.getByText('Add Repository')).toBeTruthy();
  });

  it('does not render CTA button when action not provided', () => {
    render(
      <EmptyState icon={FolderOpen} heading="No repos" description="Nothing here." />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('calls action onClick when CTA button clicked', async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={FolderOpen}
        heading="No repos"
        description="Add one."
        action={{ label: 'Add', onClick }}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByText('Add'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
