import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoginPage from './page';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signInWithOAuth: vi.fn() },
  }),
}));

describe('LoginPage', () => {
  it('renders without crashing', () => {
    render(<LoginPage />);
    expect(screen.getByText('RepoMind')).toBeInTheDocument();
  });

  it('displays "Sign in with GitHub" button', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: /sign in with github/i })).toBeInTheDocument();
  });

  it('shows app name', () => {
    render(<LoginPage />);
    expect(screen.getByText('RepoMind')).toBeInTheDocument();
  });
});
