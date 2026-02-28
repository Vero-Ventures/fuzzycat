import { isMfaEnabled } from '@/lib/supabase/mfa';
import { ClinicProfileForm } from './_components/clinic-profile-form';
import { MfaSettingsSection } from './_components/mfa-settings-section';
import { StripeConnectSection } from './_components/stripe-connect-section';

export default function ClinicSettingsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clinic Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your clinic information, payment account, and security.
        </p>
      </div>

      <div className="mt-8 space-y-8">
        <ClinicProfileForm />
        <StripeConnectSection />
        {isMfaEnabled() && <MfaSettingsSection />}
      </div>
    </div>
  );
}
