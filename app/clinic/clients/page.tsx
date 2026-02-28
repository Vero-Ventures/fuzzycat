import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ClientList } from './_components/client-list';
import { ClientStats } from './_components/client-stats';

export const metadata: Metadata = {
  title: 'Clients | FuzzyCat',
};

export default function ClinicClientsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="mt-1 text-muted-foreground">
            View all pet owners with payment plans at your clinic.
          </p>
        </div>
        <Link href="/clinic/enroll">
          <Button>+ Add New Client</Button>
        </Link>
      </div>

      <div className="mt-8">
        <ClientList />
      </div>

      <div className="mt-8">
        <ClientStats />
      </div>
    </div>
  );
}
