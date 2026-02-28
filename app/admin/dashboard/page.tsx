import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { FailedPaymentsBanner } from './_components/failed-payments-banner';
import { PlatformGrowthPlaceholder } from './_components/platform-growth-placeholder';
import { PlatformStats } from './_components/platform-stats';
import { RecentActivity } from './_components/recent-activity';
import { RecentClaims } from './_components/recent-claims';
import { RecentClinics } from './_components/recent-clinics';

export const metadata: Metadata = {
  title: 'Admin | FuzzyCat',
};

function WidgetSkeleton({ className }: { className?: string }) {
  return <Skeleton className={className ?? 'h-64 w-full'} />;
}

export default function AdminDashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Overview</h1>
        <p className="mt-1 text-muted-foreground">Platform-wide metrics and recent activity.</p>
      </div>

      <div className="mt-8 space-y-8">
        <Suspense fallback={null}>
          <FailedPaymentsBanner />
        </Suspense>

        <Suspense fallback={<WidgetSkeleton className="h-32 w-full" />}>
          <PlatformStats />
        </Suspense>

        <PlatformGrowthPlaceholder />

        <div className="grid gap-8 lg:grid-cols-2">
          <Suspense fallback={<WidgetSkeleton />}>
            <RecentClinics />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton />}>
            <RecentClaims />
          </Suspense>
        </div>

        <Suspense fallback={<WidgetSkeleton />}>
          <RecentActivity />
        </Suspense>
      </div>
    </div>
  );
}
