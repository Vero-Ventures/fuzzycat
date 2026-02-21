import { PayoutEarnings } from './_components/payout-earnings';
import { PayoutHistory } from './_components/payout-history';

export default function ClinicPayoutsPage() {
  return (
    <div className="container mx-auto max-w-5xl px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payouts</h1>
        <p className="text-muted-foreground mt-1">
          Track your payout history and revenue earned through FuzzyCat.
        </p>
      </div>

      <PayoutEarnings />
      <PayoutHistory />
    </div>
  );
}
