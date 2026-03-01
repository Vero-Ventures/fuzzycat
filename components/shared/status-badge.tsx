import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StatusBadgeSize = 'sm' | 'md';

interface StatusBadgeProps {
  status: string;
  size?: StatusBadgeSize;
  className?: string;
}

const statusStyles: Record<string, string> = {
  pending:
    'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800',
  processing:
    'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  active:
    'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  succeeded:
    'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  completed:
    'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  failed:
    'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  defaulted:
    'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  retried:
    'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
  written_off:
    'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700',
  suspended:
    'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  cancelled:
    'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700',
};

const sizeStyles: Record<StatusBadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2.5 py-0.5 text-xs',
};

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  const colorClass = statusStyles[status] ?? statusStyles.pending;
  const sizeClass = sizeStyles[size];

  return (
    <Badge
      variant="outline"
      role="status"
      aria-label={formatStatus(status)}
      className={cn(colorClass, sizeClass, className)}
    >
      {formatStatus(status)}
    </Badge>
  );
}
