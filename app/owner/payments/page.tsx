import { HydrationBoundary } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { createServerHelpers } from '@/lib/trpc/server';
import { DashboardSummary } from './_components/dashboard-summary';
import { PlanList } from './_components/plan-list';
import { QuickLinks } from './_components/quick-links';
import { RecentPayments } from './_components/recent-payments';

export const metadata: Metadata = {
  title: 'Dashboard | FuzzyCat',
};

export default async function OwnerPaymentsPage() {
  const { trpc, queryClient, dehydrate } = await createServerHelpers();

  await Promise.all([
    queryClient.prefetchQuery(trpc.owner.getDashboardSummary.queryOptions()),
    queryClient.prefetchQuery(trpc.owner.getPlans.queryOptions()),
    queryClient.prefetchQuery(trpc.owner.getRecentPayments.queryOptions()),
  ]);

  return (
    <HydrationBoundary state={dehydrate()}>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <DashboardSummary />

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <PlanList />
            <RecentPayments />
          </div>
          <div>
            <QuickLinks />
          </div>
        </div>
      </div>
    </HydrationBoundary>
  );
}
