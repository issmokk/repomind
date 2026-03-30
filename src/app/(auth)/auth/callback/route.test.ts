// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExchangeCodeForSession = vi.fn();
const mockGetSession = vi.fn();
const mockUpdateUserById = vi.fn();
const mockEncrypt = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      exchangeCodeForSession: (...args: unknown[]) => mockExchangeCodeForSession(...args),
      getSession: () => mockGetSession(),
    },
  }),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: vi.fn(() => []), set: vi.fn() }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      admin: {
        updateUserById: (...args: unknown[]) => mockUpdateUserById(...args),
      },
    },
  })),
}));

vi.mock('@/lib/crypto', () => ({
  encrypt: (...args: unknown[]) => mockEncrypt(...args),
}));

describe('GET /auth/callback', () => {
  beforeEach(() => {
    mockExchangeCodeForSession.mockReset();
    mockGetSession.mockReset();
    mockUpdateUserById.mockReset();
    mockEncrypt.mockReset();
    mockGetSession.mockResolvedValue({ data: { session: null } });
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  it('calls exchangeCodeForSession with the code param', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    const { GET } = await import('./route');
    const req = new Request('http://localhost:3000/auth/callback?code=test-code');
    await GET(req as never);
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('test-code');
  });

  it('redirects to / on success', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    const { GET } = await import('./route');
    const req = new Request('http://localhost:3000/auth/callback?code=test-code');
    const res = await GET(req as never);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
  });

  it('redirects to /login when code is missing', async () => {
    const { GET } = await import('./route');
    const req = new Request('http://localhost:3000/auth/callback');
    const res = await GET(req as never);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('extracts provider_token from session after code exchange', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    mockGetSession.mockResolvedValue({
      data: {
        session: { user: { id: 'user-1' }, provider_token: 'gho_abc123' },
      },
    });
    mockEncrypt.mockReturnValue('encrypted-token');
    mockUpdateUserById.mockResolvedValue({ error: null });

    const { GET } = await import('./route');
    const req = new Request('http://localhost:3000/auth/callback?code=test-code');
    await GET(req as never);

    expect(mockEncrypt).toHaveBeenCalledWith('gho_abc123');
  });

  it('stores encrypted provider_token in user metadata', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    mockGetSession.mockResolvedValue({
      data: {
        session: { user: { id: 'user-1' }, provider_token: 'gho_xyz789' },
      },
    });
    mockEncrypt.mockReturnValue('encrypted-xyz');
    mockUpdateUserById.mockResolvedValue({ error: null });

    const { GET } = await import('./route');
    const req = new Request('http://localhost:3000/auth/callback?code=test-code');
    await GET(req as never);

    expect(mockUpdateUserById).toHaveBeenCalledWith('user-1', {
      app_metadata: { encrypted_github_token: 'encrypted-xyz' },
    });
  });

  it('still redirects to / on success when no provider_token present', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' }, provider_token: null } },
    });

    const { GET } = await import('./route');
    const req = new Request('http://localhost:3000/auth/callback?code=test-code');
    const res = await GET(req as never);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/');
    expect(mockEncrypt).not.toHaveBeenCalled();
  });

  it('still redirects to /login?error=auth_failed on exchange error', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: new Error('bad code') });

    const { GET } = await import('./route');
    const req = new Request('http://localhost:3000/auth/callback?code=bad-code');
    const res = await GET(req as never);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login?error=auth_failed');
  });
});
