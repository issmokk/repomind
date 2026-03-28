// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    const url = new URL(pathname, 'http://localhost:3000');
    return new Request(url.toString());
  }

  it('authenticated request passes through', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: '123' } } });
    const { middleware } = await import('./middleware');
    const req = createRequest('/chat');
    // @ts-expect-error simplified request for testing
    const res = await middleware(req);
    expect(res.status).not.toBe(307);
  });

  it('unauthenticated request to /chat redirects to /login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { middleware } = await import('./middleware');
    const req = createRequest('/chat');
    // @ts-expect-error simplified request for testing
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('request to /login passes through even when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { middleware } = await import('./middleware');
    const req = createRequest('/login');
    // @ts-expect-error simplified request for testing
    const res = await middleware(req);
    expect(res.status).not.toBe(307);
  });

  it('request to /auth/callback passes through even when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { middleware } = await import('./middleware');
    const req = createRequest('/auth/callback');
    // @ts-expect-error simplified request for testing
    const res = await middleware(req);
    expect(res.status).not.toBe(307);
  });

  it('middleware matcher excludes static assets', () => {
    const pattern = new RegExp(config.matcher[0]);
    expect(pattern.test('/_next/static/foo.js')).toBe(false);
    expect(pattern.test('/favicon.ico')).toBe(false);
    expect(pattern.test('/image.png')).toBe(false);
    expect(pattern.test('/chat')).toBe(true);
    expect(pattern.test('/login')).toBe(true);
  });
});
