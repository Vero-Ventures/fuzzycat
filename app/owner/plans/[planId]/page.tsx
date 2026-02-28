import { HydrationBoundary } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { createServerHelpers } from '@/lib/trpc/server';
import { PlanDetailContent } from './_components/plan-detail-content';

export const metadata: Metadata = {
  title: 'Plan Details | FuzzyCat',
};

export default async function OwnerPlanDetailPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  const { trpc, queryClient, dehydrate } = await createServerHelpers();

  await Promise.all([
    queryClient.prefetchQuery(trpc.owner.getPlanById.queryOptions({ planId })),
    queryClient.prefetchQuery(
      trpc.owner.getPaymentHistory.queryOptions({ planId, page: 1, pageSize: 20 }),
    ),
  ]);

  return (
    <HydrationBoundary state={dehydrate()}>
      <PlanDetailContent planId={planId} />
    </HydrationBoundary>
  );
}
