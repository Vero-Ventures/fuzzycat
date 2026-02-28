import type { Metadata } from 'next';
import { SettingsContent } from './_components/settings-content';

export const metadata: Metadata = {
  title: 'Settings | FuzzyCat',
};

export default function OwnerSettingsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account</p>
      </div>

      <SettingsContent />
    </div>
  );
}
