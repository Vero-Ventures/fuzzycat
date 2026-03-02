import type { Metadata } from 'next';
import { ApiKeysSection } from './_components/api-keys-section';

export const metadata: Metadata = {
  title: 'Clinic Settings | FuzzyCat',
};

export default function ClinicSettingsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clinic Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your clinic information, payment account, and API integrations.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        <ApiKeysSection />
      </div>
    </div>
  );
}
