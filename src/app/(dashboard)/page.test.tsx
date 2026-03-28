import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('Dashboard home page', () => {
  it('redirects to /chat', async () => {
    const { default: Page } = await import('./page');
    const { redirect } = await import('next/navigation');
    Page();
    expect(redirect).toHaveBeenCalledWith('/chat');
  });
});
