import { HydrationBoundary } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { createServerHelpers } from '@/lib/trpc/server';
import { PlansContent } from './_components/plans-content';

export const metadata: Metadata = {
  title: 'My Plans | FuzzyCat',
};

export default async function OwnerPlansPage() {
  const { trpc, queryClient, dehydrate } = await createServerHelpers();

  await queryClient.prefetchQuery(trpc.owner.getPlans.queryOptions());

  return (
    <HydrationBoundary state={dehydrate()}>
      <PlansContent />
    </HydrationBoundary>
  );
}
