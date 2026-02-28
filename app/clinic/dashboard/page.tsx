import { HydrationBoundary } from '@tanstack/react-query';
import { createServerHelpers } from '@/lib/trpc/server';
import { DashboardContent } from './_components/dashboard-content';
import { InitiateEnrollmentButton } from './_components/initiate-enrollment-button';
import { RevenueTable } from './_components/revenue-table';

export default async function ClinicDashboardPage() {
  const { trpc, queryClient, dehydrate } = await createServerHelpers();

  await Promise.all([
    queryClient.prefetchQuery(trpc.clinic.getDashboardStats.queryOptions()),
    queryClient.prefetchQuery(trpc.clinic.getMonthlyRevenue.queryOptions()),
  ]);

  return (
    <HydrationBoundary state={dehydrate()}>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Clinic Overview</h1>
            <p className="mt-1 text-muted-foreground">
              Welcome back. Here is a summary of your clinic activity.
            </p>
          </div>
          <InitiateEnrollmentButton />
        </div>

        <DashboardContent />

        <div className="mt-8">
          <RevenueTable />
        </div>
      </div>
    </HydrationBoundary>
  );
}
