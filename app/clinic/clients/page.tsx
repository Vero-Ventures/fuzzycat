import { ClientList } from './_components/client-list';

export default function ClinicClientsPage() {
  return (
    <div className="container mx-auto max-w-5xl px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <p className="text-muted-foreground mt-1">
          View all pet owners with payment plans at your clinic.
        </p>
      </div>

      <ClientList />
    </div>
  );
}
