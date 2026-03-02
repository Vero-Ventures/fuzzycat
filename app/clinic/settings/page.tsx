import { HydrationBoundary } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { createServerHelpers } from '@/lib/trpc/server';
import { ApiKeysSection } from './_components/api-keys-section';
import { ClinicProfileForm } from './_components/clinic-profile-form';
import { MfaSettingsSection } from './_components/mfa-settings-section';
import { StripeConnectSection } from './_components/stripe-connect-section';

export const metadata: Metadata = {
  title: 'Clinic Settings | FuzzyCat',
};

export default async function ClinicSettingsPage() {
  const { trpc, queryClient, dehydrate } = await createServerHelpers();

  await queryClient.prefetchQuery(trpc.clinic.getProfile.queryOptions());

  return (
    <HydrationBoundary state={dehydrate()}>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clinic Settings</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your clinic information, payment account, and API integrations.
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <ClinicProfileForm />
          <StripeConnectSection />
          <ApiKeysSection />
          <MfaSettingsSection />
        </div>
      </div>
    </HydrationBoundary>
  );
}
