'use client';

import { Clock } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';

interface IndexingTabPlaceholderProps {
  repoId: string;
}

export function IndexingTabPlaceholder({ repoId: _repoId }: IndexingTabPlaceholderProps) {
  return (
    <EmptyState
      icon={Clock}
      heading="Indexing Status"
      description="Real-time indexing progress will appear here."
    />
  );
}
