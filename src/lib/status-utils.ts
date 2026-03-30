import type { IndexingJobStatus } from '@/types/indexing';

export type StatusBadgeVariant = 'indexed' | 'indexing' | 'error' | 'pending' | 'partial';

export function mapJobStatus(status: IndexingJobStatus | null | undefined): StatusBadgeVariant {
  if (!status || status === 'pending') return 'pending';
  if (status === 'completed') return 'indexed';
  if (status === 'failed') return 'error';
  if (status === 'partial') return 'partial';
  return 'indexing';
}
