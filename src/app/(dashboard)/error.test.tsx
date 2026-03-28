import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ErrorBoundary from './error';

describe('Error boundary', () => {
  it('renders error message and Try again button', () => {
    const reset = vi.fn();
    render(<ErrorBoundary error={new Error('test error')} reset={reset} />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('calls reset on Try again click', () => {
    const reset = vi.fn();
    render(<ErrorBoundary error={new Error('test error')} reset={reset} />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
