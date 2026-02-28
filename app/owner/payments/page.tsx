import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardSummary } from './_components/dashboard-summary';
import { PlanList } from './_components/plan-list';
import { QuickLinks } from './_components/quick-links';
import { RecentPayments } from './_components/recent-payments';

function WidgetSkeleton({ className }: { className?: string }) {
  return <Skeleton className={className ?? 'h-64 w-full'} />;
}

export default function OwnerPaymentsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Suspense fallback={<WidgetSkeleton className="h-32 w-full" />}>
        <DashboardSummary />
      </Suspense>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <Suspense fallback={<WidgetSkeleton />}>
            <PlanList />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton />}>
            <RecentPayments />
          </Suspense>
        </div>
        <div>
          <QuickLinks />
        </div>
      </div>
    </div>
  );
}
