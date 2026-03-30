'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { IndexingJob } from '@/types/indexing';

const MAX_BACKOFF = 30000;

interface UseIndexingStatusReturn {
  job: IndexingJob | null;
  isConnected: boolean;
}

export function useIndexingStatus(repoId: string | null): UseIndexingStatusReturn {
  const [job, setJob] = useState<IndexingJob | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const backoffRef = useRef(1000);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectRef = useRef<() => void>(() => {});
  const doneRef = useRef(false);

  const cleanup = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!repoId || doneRef.current) return;
    cleanup();

    const es = new EventSource(`/api/repos/${repoId}/status/stream`);
    esRef.current = es;

    es.addEventListener('open', () => {
      setIsConnected(true);
      backoffRef.current = 1000;
    });

    es.addEventListener('job-update', (e) => {
      doneRef.current = false;
      try {
        setJob(JSON.parse(e.data));
      } catch {
        // malformed data
      }
    });

    es.addEventListener('job-complete', (e) => {
      doneRef.current = true;
      try {
        setJob(JSON.parse(e.data));
      } catch {
        // malformed data
      }
      es.close();
      esRef.current = null;
      setIsConnected(false);
    });

    es.addEventListener('no-job', () => {
      setJob(null);
    });

    es.addEventListener('error', () => {
      setIsConnected(false);
      if (es.readyState === EventSource.CLOSED && !doneRef.current) {
        reconnectTimerRef.current = setTimeout(() => {
          backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF);
          connectRef.current();
        }, backoffRef.current);
      }
    });
  }, [repoId, cleanup]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    doneRef.current = false;
    connect();
    return cleanup;
  }, [connect, cleanup]);

  useEffect(() => {
    function handleVisibility() {
      if (document.hidden) {
        cleanup();
        setIsConnected(false);
      } else if (!doneRef.current) {
        connectRef.current();
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [cleanup]);

  return { job, isConnected };
}
