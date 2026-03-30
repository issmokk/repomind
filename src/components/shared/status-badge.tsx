import { cn } from '@/lib/utils';

type Status = 'indexed' | 'indexing' | 'error' | 'pending' | 'partial';

const statusConfig: Record<Status, { label: string; dotClass: string; pulse?: boolean }> = {
  indexed: { label: 'Indexed', dotClass: 'bg-status-success' },
  indexing: { label: 'Indexing', dotClass: 'bg-status-info', pulse: true },
  error: { label: 'Error', dotClass: 'bg-status-error' },
  pending: { label: 'Pending', dotClass: 'bg-status-warning' },
  partial: { label: 'Partial', dotClass: 'bg-orange-500' },
};

interface StatusBadgeProps {
  status: Status;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        data-testid="status-dot"
        className={cn('h-2 w-2 rounded-full', config.dotClass, config.pulse && 'animate-pulse')}
      />
      <span className="text-xs text-muted-foreground">{config.label}</span>
    </span>
  );
}
