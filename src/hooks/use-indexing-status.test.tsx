import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIndexingStatus } from './use-indexing-status';

type EventHandler = ((e: MessageEvent) => void) | (() => void);

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  readyState = 0;
  listeners: Record<string, EventHandler[]> = {};
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    setTimeout(() => this.emit('open'), 0);
  }

  addEventListener(event: string, handler: EventHandler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  removeEventListener(event: string, handler: EventHandler) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((h) => h !== handler);
    }
  }

  emit(event: string, data?: string) {
    const handlers = this.listeners[event] || [];
    if (event === 'open' || event === 'error') {
      handlers.forEach((h) => (h as () => void)());
    } else {
      handlers.forEach((h) => (h as (e: MessageEvent) => void)(new MessageEvent(event, { data })));
    }
  }

  close() {
    this.closed = true;
    this.readyState = 2;
  }

  static CLOSED = 2;
}

const originalEventSource = global.EventSource;

beforeEach(() => {
  MockEventSource.instances = [];
  (global as unknown as Record<string, unknown>).EventSource = MockEventSource;
});

afterEach(() => {
  (global as unknown as Record<string, unknown>).EventSource = originalEventSource;
});

describe('useIndexingStatus', () => {
  it('connects to EventSource with correct URL', async () => {
    renderHook(() => useIndexingStatus('abc123'));

    await vi.waitFor(() => {
      expect(MockEventSource.instances.length).toBeGreaterThan(0);
    });
    expect(MockEventSource.instances[0].url).toBe('/api/repos/abc123/status/stream');
  });

  it('updates job state on job-update events', async () => {
    const { result } = renderHook(() => useIndexingStatus('repo-1'));

    await vi.waitFor(() => {
      expect(MockEventSource.instances.length).toBeGreaterThan(0);
    });

    const es = MockEventSource.instances[0];
    const jobData = { id: 'job-1', status: 'processing', processedFiles: 10, totalFiles: 50 };

    act(() => {
      es.emit('job-update', JSON.stringify(jobData));
    });

    expect(result.current.job).toEqual(jobData);
  });

  it('sets isConnected to true on open', async () => {
    const { result } = renderHook(() => useIndexingStatus('repo-1'));

    await act(async () => {
      await vi.waitFor(() => {
        expect(MockEventSource.instances.length).toBeGreaterThan(0);
      });
    });

    await vi.waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('sets isConnected to false on error', async () => {
    const { result } = renderHook(() => useIndexingStatus('repo-1'));

    await vi.waitFor(() => {
      expect(MockEventSource.instances.length).toBeGreaterThan(0);
    });

    const es = MockEventSource.instances[0];
    act(() => {
      es.emit('open');
    });

    expect(result.current.isConnected).toBe(true);

    act(() => {
      es.readyState = 2;
      es.emit('error');
    });

    expect(result.current.isConnected).toBe(false);
  });

  it('cleans up EventSource on unmount', async () => {
    const { unmount } = renderHook(() => useIndexingStatus('repo-1'));

    await vi.waitFor(() => {
      expect(MockEventSource.instances.length).toBeGreaterThan(0);
    });

    const es = MockEventSource.instances[0];
    unmount();

    expect(es.closed).toBe(true);
  });

  it('does not connect when repoId is null', () => {
    renderHook(() => useIndexingStatus(null));
    expect(MockEventSource.instances.length).toBe(0);
  });
});
