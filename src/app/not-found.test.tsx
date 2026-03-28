import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import NotFound from './not-found';

describe('NotFound', () => {
  it('renders 404 message with link to dashboard', () => {
    render(<NotFound />);
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toHaveAttribute('href', '/');
  });
});
