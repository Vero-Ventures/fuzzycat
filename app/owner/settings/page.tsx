import type { Metadata } from 'next';
import { ActivePlansSection } from './_components/active-plans-section';
import { PaymentMethodSection } from './_components/payment-method-section';
import { ProfileForm } from './_components/profile-form';

export const metadata: Metadata = {
  title: 'Settings | FuzzyCat',
};

export default function OwnerSettingsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your profile, payment method, and plan agreements.
        </p>
      </div>

      <ProfileForm />
      <PaymentMethodSection />
      <ActivePlansSection />
    </div>
  );
}
