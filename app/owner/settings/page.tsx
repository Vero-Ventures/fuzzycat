import { HydrationBoundary } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { createServerHelpers } from '@/lib/trpc/server';
import { SettingsContent } from './_components/settings-content';

export const metadata: Metadata = {
  title: 'Settings | FuzzyCat',
};

export default async function OwnerSettingsPage() {
  const { trpc, queryClient, dehydrate } = await createServerHelpers();

  await Promise.all([
    queryClient.prefetchQuery(trpc.owner.getProfile.queryOptions()),
    queryClient.prefetchQuery(trpc.owner.getPets.queryOptions()),
    queryClient.prefetchQuery(trpc.owner.getPaymentMethodDetails.queryOptions()),
    queryClient.prefetchQuery(trpc.owner.getPlans.queryOptions()),
  ]);

  return (
    <HydrationBoundary state={dehydrate()}>
      <div className="container mx-auto max-w-3xl px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account</p>
        </div>

        <SettingsContent />
      </div>
    </HydrationBoundary>
  );
}
