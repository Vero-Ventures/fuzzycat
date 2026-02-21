import { ClinicProfileForm } from './_components/clinic-profile-form';
import { MfaSettingsSection } from './_components/mfa-settings-section';
import { StripeConnectSection } from './_components/stripe-connect-section';

export default function ClinicSettingsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clinic Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your clinic information, payment account, and security.
        </p>
      </div>

      <ClinicProfileForm />
      <StripeConnectSection />
      <MfaSettingsSection />
    </div>
  );
}
