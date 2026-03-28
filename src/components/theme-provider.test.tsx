import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThemeProvider } from './theme-provider';

vi.mock('next-themes', () => ({
  ThemeProvider: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div data-testid="mock-theme-provider" {...props}>
      {children}
    </div>
  ),
}));

describe('ThemeProvider', () => {
  it('renders children without crashing', () => {
    render(
      <ThemeProvider>
        <div>test content</div>
      </ThemeProvider>,
    );
    expect(screen.getByText('test content')).toBeInTheDocument();
  });

  it('passes attribute="class" to next-themes', () => {
    render(
      <ThemeProvider attribute="class">
        <div>child</div>
      </ThemeProvider>,
    );
    const provider = screen.getByTestId('mock-theme-provider');
    expect(provider).toHaveAttribute('attribute', 'class');
  });
});
