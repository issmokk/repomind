// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreateBrowserClient = vi.fn(() => ({ auth: {} }));

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: mockCreateBrowserClient,
}));

describe('Supabase browser client', () => {
  beforeEach(() => {
    mockCreateBrowserClient.mockClear();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  it('returns a Supabase client object', async () => {
    const { createClient } = await import('./client');
    const client = createClient();
    expect(client).toBeTruthy();
    expect(client).toHaveProperty('auth');
  });

  it('uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY env vars', async () => {
    const { createClient } = await import('./client');
    createClient();
    expect(mockCreateBrowserClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
    );
  });
});
