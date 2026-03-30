import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it.each([
    ['indexed', 'Indexed'],
    ['indexing', 'Indexing'],
    ['error', 'Error'],
    ['pending', 'Pending'],
    ['partial', 'Partial'],
  ] as const)('renders correct label for %s status', (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('indexing status shows pulse animation class', () => {
    const { container } = render(<StatusBadge status="indexing" />);
    const dot = container.querySelector('[data-testid="status-dot"]');
    expect(dot?.className).toContain('animate-pulse');
  });

  it('non-indexing status does not show pulse', () => {
    const { container } = render(<StatusBadge status="indexed" />);
    const dot = container.querySelector('[data-testid="status-dot"]');
    expect(dot?.className).not.toContain('animate-pulse');
  });
});
