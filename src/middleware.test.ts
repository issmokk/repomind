// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { config } from './middleware';

const mockGetUser = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

describe('middleware', () => {
  beforeEach(() => {
    mockGetUser.mockClear();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  function createRequest(pathname: string) {
    return new NextRequest(new URL(pathname, 'http://localhost:3000'));
  }

  it('authenticated request passes through', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: '123' } } });
    const { middleware } = await import('./middleware');
    const res = await middleware(createRequest('/chat'));
    expect(res.status).not.toBe(307);
  });

  it('unauthenticated request to /chat redirects to /login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { middleware } = await import('./middleware');
    const res = await middleware(createRequest('/chat'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('request to /login passes through even when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { middleware } = await import('./middleware');
    const res = await middleware(createRequest('/login'));
    expect(res.status).not.toBe(307);
  });

  it('request to /auth/callback passes through even when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { middleware } = await import('./middleware');
    const res = await middleware(createRequest('/auth/callback'));
    expect(res.status).not.toBe(307);
  });

  it('middleware matcher pattern is configured', () => {
    expect(config.matcher).toBeDefined();
    expect(config.matcher.length).toBeGreaterThan(0);
  });
});
