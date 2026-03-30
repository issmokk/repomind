'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import type { Repository, RepositorySettings } from '@/types/repository';
import type { IndexingJob } from '@/types/indexing';

type JobResponse = IndexingJob | { status: 'none' };

export function useRepoDetail(id: string) {
  const {
    data: repo,
    error: repoError,
    isLoading: repoLoading,
    mutate: mutateRepo,
  } = useSWR<Repository>(`/api/repos/${id}`, fetcher);

  const {
    data: settings,
    error: settingsError,
    isLoading: settingsLoading,
    mutate: mutateSettings,
  } = useSWR<RepositorySettings>(`/api/repos/${id}/settings`, fetcher);

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
