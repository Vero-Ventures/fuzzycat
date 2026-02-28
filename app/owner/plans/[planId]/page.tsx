import { HydrationBoundary } from '@tanstack/react-query';
import { createServerHelpers } from '@/lib/trpc/server';
import { PlanDetailContent } from './_components/plan-detail-content';

export default async function OwnerPlanDetailPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  const { trpc, queryClient, dehydrate } = await createServerHelpers();

  await queryClient.prefetchQuery(trpc.owner.getPlanById.queryOptions({ planId }));

  return (
    <HydrationBoundary state={dehydrate()}>
      <PlanDetailContent planId={planId} />
    </HydrationBoundary>
  );
}
