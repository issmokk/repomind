import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmationDialog } from './confirmation-dialog';

describe('ConfirmationDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: 'Delete repository?',
    description: 'This action cannot be undone.',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders warning text and action buttons when open', () => {
    render(<ConfirmationDialog {...defaultProps} />);
    expect(screen.getByText('Delete repository?')).toBeTruthy();
    expect(screen.getByText('This action cannot be undone.')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('calls onConfirm when action button clicked', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmationDialog {...defaultProps} onConfirm={onConfirm} />);
    const user = userEvent.setup();
    await user.click(screen.getByText('Delete'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when cancel button clicked', async () => {
    const onCancel = vi.fn();
    render(<ConfirmationDialog {...defaultProps} onCancel={onCancel} />);
    const user = userEvent.setup();
    await user.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('uses custom confirm label', () => {
    render(<ConfirmationDialog {...defaultProps} confirmLabel="Remove" />);
    expect(screen.getByText('Remove')).toBeTruthy();
  });
});
