import { Skeleton } from '@/components/ui/skeleton';

export function CardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-6 shadow">
      <div className="space-y-3">
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b px-4 py-3">
      <Skeleton className="h-4 w-1/6" />
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-4 w-1/6" />
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-4 w-1/6 ml-auto" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-6 shadow">
      <Skeleton className="h-4 w-1/3 mb-2" />
      <Skeleton className="h-8 w-2/5 mb-1" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>

      {/* Stat cards row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border bg-card shadow">
        <div className="border-b px-4 py-3">
          <Skeleton className="h-5 w-1/4" />
        </div>
        <TableRowSkeleton />
        <TableRowSkeleton />
        <TableRowSkeleton />
        <TableRowSkeleton />
        <TableRowSkeleton />
      </div>
    </div>
  );
}
