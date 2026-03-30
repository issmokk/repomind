// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/app/api/repos/_helpers', () => ({
  getAuthContext: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/crypto', () => ({
  decrypt: vi.fn(),
}));

import { GET } from './route';
import { getAuthContext } from '@/app/api/repos/_helpers';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { NextResponse } from 'next/server';

const mockAuthContext = {
  userId: 'user-1',
  orgId: 'org-1',
  supabase: {},
  storage: {},
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(getAuthContext).mockResolvedValue(mockAuthContext as never);
});

describe('GET /api/github/repos', () => {
  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(
      NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    );
    const req = new NextRequest('http://localhost/api/github/repos');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when no stored GitHub token exists', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { app_metadata: {} } },
        }),
      },
    } as never);

    const req = new NextRequest('http://localhost/api/github/repos');
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.reconnect).toBe(true);
  });

  it('proxies request to GitHub API with decrypted token', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { app_metadata: { encrypted_github_token: 'enc-token' } } },
        }),
      },
    } as never);
    vi.mocked(decrypt).mockReturnValue('gho_real_token');

    const mockRepos = [{ full_name: 'owner/repo' }];
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockRepos), { status: 200 }),
    );

    const req = new NextRequest('http://localhost/api/github/repos?per_page=100&sort=updated');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(fetchCall[0]).toContain('api.github.com/user/repos');
    expect((fetchCall[1]!.headers as Record<string, string>).Authorization).toBe('Bearer gho_real_token');
  });

  it('returns the list of repos from GitHub API', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { app_metadata: { encrypted_github_token: 'enc' } } },
        }),
      },
    } as never);
    vi.mocked(decrypt).mockReturnValue('token');

    const mockRepos = [{ full_name: 'a/b' }, { full_name: 'c/d' }];
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockRepos), { status: 200 }),
    );

    const req = new NextRequest('http://localhost/api/github/repos');
    const res = await GET(req);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].full_name).toBe('a/b');
  });

  it('passes page and per_page query params to GitHub', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { app_metadata: { encrypted_github_token: 'enc' } } },
        }),
      },
    } as never);
    vi.mocked(decrypt).mockReturnValue('token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 }),
    );

    const req = new NextRequest('http://localhost/api/github/repos?page=2&per_page=50');
    await GET(req);

    const fetchUrl = vi.mocked(globalThis.fetch).mock.calls[0][0] as string;
    expect(fetchUrl).toContain('page=2');
    expect(fetchUrl).toContain('per_page=50');
  });

  it('returns 401 with reconnect hint when GitHub returns 401', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { app_metadata: { encrypted_github_token: 'enc' } } },
        }),
      },
    } as never);
    vi.mocked(decrypt).mockReturnValue('expired-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 }),
    );

    const req = new NextRequest('http://localhost/api/github/repos');
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('github_token_expired');
    expect(body.reconnect).toBe(true);
  });
});
