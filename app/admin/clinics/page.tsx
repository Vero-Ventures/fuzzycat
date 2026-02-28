import type { Metadata } from 'next';
import { ClinicList } from './_components/clinic-list';

export const metadata: Metadata = {
  title: 'Clinics | FuzzyCat Admin',
};

export default function AdminClinicsPage() {
  return (
    <div className="container mx-auto max-w-6xl px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Manage Clinics</h1>
        <p className="text-muted-foreground mt-1">
          Review, approve, and manage registered veterinary clinics.
        </p>
      </div>

      <ClinicList />
    </div>
  );
}
