import { PaymentList } from './_components/payment-list';

export default function AdminPaymentsPage() {
  return (
    <div className="container mx-auto max-w-6xl px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payment Monitoring</h1>
        <p className="text-muted-foreground mt-1">
          Track and manage all payments across the platform.
        </p>
      </div>

      <PaymentList />
    </div>
  );
}
