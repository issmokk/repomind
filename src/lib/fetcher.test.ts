// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetcher, FetchError } from './fetcher';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('fetcher', () => {
  it('returns parsed JSON on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ name: 'test' }), { status: 200 }),
    );
    const result = await fetcher<{ name: string }>('/api/test');
    expect(result).toEqual({ name: 'test' });
  });

  it('throws FetchError with status on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Not found' }), { status: 404 }),
    );
    try {
      await fetcher('/api/test');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      const fetchErr = err as FetchError;
      expect(fetchErr.status).toBe(404);
      expect(fetchErr.message).toBe('Not found');
      expect(fetchErr.body).toEqual({ error: 'Not found' });
    }
  });

  it('FetchError.body contains the full JSON body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'expired', reconnect: true }), { status: 401 }),
    );
    try {
      await fetcher('/api/test');
      expect.fail('should have thrown');
    } catch (err) {
      const fetchErr = err as FetchError;
      expect(fetchErr.status).toBe(401);
      expect(fetchErr.body?.reconnect).toBe(true);
    }
  });

  it('falls back to status message when body is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('plain text error', { status: 500, headers: { 'content-type': 'text/plain' } }),
    );
    try {
      await fetcher('/api/test');
      expect.fail('should have thrown');
    } catch (err) {
      const fetchErr = err as FetchError;
      expect(fetchErr.status).toBe(500);
      expect(fetchErr.body).toBeNull();
    }
  });
});
