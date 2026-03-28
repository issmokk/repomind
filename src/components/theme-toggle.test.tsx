import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThemeToggle } from './theme-toggle';

const mockSetTheme = vi.fn();

vi.mock('next-themes', () => ({
  useTheme: () => ({ setTheme: mockSetTheme, theme: 'system' }),
}));

describe('ThemeToggle', () => {
  it('renders a button', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('button has "Toggle theme" accessible name', () => {
    render(<ThemeToggle />);
    expect(screen.getByText('Toggle theme')).toBeInTheDocument();
  });
});
