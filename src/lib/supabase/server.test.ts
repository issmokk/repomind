// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreateServerClient = vi.fn(() => ({ auth: {} }));

vi.mock('@supabase/ssr', () => ({
  createServerClient: mockCreateServerClient,
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn(() => []),
    set: vi.fn(),
  }),
}));

describe('Supabase server client', () => {
  beforeEach(() => {
    mockCreateServerClient.mockClear();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  it('returns a Supabase client when given a cookie store', async () => {
    const { createClient } = await import('./server');
    const client = await createClient();
    expect(client).toBeTruthy();
    expect(client).toHaveProperty('auth');
  });

  it('configures cookie callbacks (getAll, setAll)', async () => {
    const { createClient } = await import('./server');
    await createClient();
    expect(mockCreateServerClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      }),
    );
  });
});
