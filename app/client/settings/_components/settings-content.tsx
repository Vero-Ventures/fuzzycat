'use client';

import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AccountSafetySection } from './account-safety-section';
import { ActivePlansSection } from './active-plans-section';
import { PaymentMethodSection } from './payment-method-section';
import { PetsSection } from './pets-section';
import { ProfileForm } from './profile-form';

function SectionSkeleton() {
  return <Skeleton className="h-48 w-full rounded-lg" />;
}

export function SettingsContent() {
  return (
    <div className="space-y-8">
      <Suspense fallback={<SectionSkeleton />}>
        <ProfileForm />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <PetsSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <PaymentMethodSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <ActivePlansSection />
      </Suspense>

      <AccountSafetySection />
    </div>
  );
}
