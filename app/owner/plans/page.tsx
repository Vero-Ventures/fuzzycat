import { HydrationBoundary } from '@tanstack/react-query';
import { createServerHelpers } from '@/lib/trpc/server';
import { PlansContent } from './_components/plans-content';

export default async function OwnerPlansPage() {
  const { trpc, queryClient, dehydrate } = await createServerHelpers();

  await queryClient.prefetchQuery(trpc.owner.getPlans.queryOptions());

  return (
    <HydrationBoundary state={dehydrate()}>
      <PlansContent />
    </HydrationBoundary>
  );
}
