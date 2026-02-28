'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { useTRPC } from '@/lib/trpc/client';
import type { DashboardStatsData } from './dashboard-stats';
import { DashboardStats, DashboardStatsSkeleton } from './dashboard-stats';
import { RecentEnrollments, RecentEnrollmentsSkeleton } from './recent-enrollments';
import { UpcomingPayments, UpcomingPaymentsSkeleton } from './upcoming-payments';

/**
 * Single client component that owns the getDashboardStats query.
 * Eliminates triple useQuery subscriptions that caused cascading re-renders
 * (3 components × re-render per data update = INP regression on mobile).
 */
export function DashboardContent() {
  const trpc = useTRPC();
  const { data, isLoading, error } = useQuery(trpc.clinic.getDashboardStats.queryOptions());

  if (isLoading) {
    return (
      <>
        <div className="mt-8">
          <DashboardStatsSkeleton />
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentEnrollmentsSkeleton />
          </div>
          <div>
            <UpcomingPaymentsSkeleton />
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div className="mt-8">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              Unable to load dashboard data. Please try refreshing the page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = data as DashboardStatsData;

  return (
    <>
      <div className="mt-8">
        <DashboardStats data={stats} />
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentEnrollments enrollments={stats.recentEnrollments} />
        </div>
        <div>
          <UpcomingPayments enrollments={stats.recentEnrollments} />
        </div>
      </div>
    </>
  );
}
