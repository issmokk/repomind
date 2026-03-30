'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import useSWR from 'swr';
import { fetcher, FetchError } from '@/lib/fetcher';

export type GitHubRepo = {
  full_name: string;
  private: boolean;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
};

export function useGitHubRepos() {
  const [search, setSearch] = useState('');
  const [accumulated, setAccumulated] = useState<GitHubRepo[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const nextPageRef = useRef(2);

  const { data, error, isLoading } = useSWR<GitHubRepo[]>(
    '/api/github/repos?per_page=100&sort=updated&page=1',
    fetcher,
    {
      onSuccess(repos) {
        setAccumulated(repos);
        setHasMore(repos.length >= 100);
        nextPageRef.current = 2;
      },
      onError() {
        setHasMore(false);
      },
    },
  );

  const needsReconnect =
    error instanceof FetchError ? error.status === 401 : false;

  const repos = useMemo(() => {
    const allRepos = accumulated.length > 0 ? accumulated : (data ?? []);
    if (!search) return allRepos;
    const lower = search.toLowerCase();
    return allRepos.filter((r) => r.full_name.toLowerCase().includes(lower));
  }, [accumulated, data, search]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = nextPageRef.current;
      const res = await fetch(`/api/github/repos?per_page=100&sort=updated&page=${page}`);
      if (!res.ok) {
        setHasMore(false);
        return;
      }
      const newRepos: GitHubRepo[] = await res.json();
      setAccumulated((prev) => {
        const existing = new Set(prev.map((r) => r.full_name));
        const unique = newRepos.filter((r) => !existing.has(r.full_name));
        return [...prev, ...unique];
      });
      setHasMore(newRepos.length >= 100);
      nextPageRef.current = page + 1;
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore]);

  return { repos, isLoading: isLoading || loadingMore, error, needsReconnect, search, setSearch, loadMore, hasMore };
}
