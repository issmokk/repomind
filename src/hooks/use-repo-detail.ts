'use client';

import useSWR from 'swr';
import { fetcher, FetchError } from '@/lib/fetcher';
import type { Repository, RepositorySettings } from '@/types/repository';
import type { IndexingJob } from '@/types/indexing';

async function settingsFetcher(url: string): Promise<RepositorySettings | null> {
  try {
    return await fetcher<RepositorySettings>(url);
  } catch (err) {
    if (err instanceof FetchError && err.status === 404) return null;
    throw err;
  }
}

type JobResponse = IndexingJob | { status: 'none' };

export function useRepoDetail(id: string) {
  const {
    data: repo,
    error: repoError,
    isLoading: repoLoading,
    mutate: mutateRepo,
  } = useSWR<Repository>(`/api/repos/${id}`, fetcher);

  const {
    data: settingsData,
    error: settingsError,
    isLoading: settingsLoading,
    mutate: mutateSettings,
  } = useSWR<RepositorySettings | null>(`/api/repos/${id}/settings`, settingsFetcher);

  const settings = settingsData ?? undefined;

  const {
    data: jobData,
    error: jobError,
    isLoading: jobLoading,
    mutate: mutateJob,
  } = useSWR<JobResponse>(`/api/repos/${id}/status`, fetcher);

  const latestJob: IndexingJob | null =
    jobData && 'id' in jobData ? jobData : null;

  return {
    repo,
    settings,
    latestJob,
    isLoading: repoLoading || settingsLoading || jobLoading,
    error: repoError ?? settingsError ?? jobError,
    mutateRepo,
    mutateSettings,
    mutateJob,
  };
}
