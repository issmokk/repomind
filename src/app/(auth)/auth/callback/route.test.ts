// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExchangeCodeForSession = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
  }),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: vi.fn(() => []), set: vi.fn() }),
}));

describe('GET /auth/callback', () => {
  beforeEach(() => {
    mockExchangeCodeForSession.mockReset();
  });

  it('calls exchangeCodeForSession with the code param', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    const { GET } = await import('./route');
    const req = new Request('http://localhost:3000/auth/callback?code=test-code');
    await GET(req);
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('test-code');
  });

  it('redirects to / on success', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    const { GET } = await import('./route');
    const req = new Request('http://localhost:3000/auth/callback?code=test-code');
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
  });

  it('redirects to /login when code is missing', async () => {
    const { GET } = await import('./route');
    const req = new Request('http://localhost:3000/auth/callback');
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });
});
