import { CalendarDays, Clock, Landmark, TableProperties } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const PLANNED_FEATURES = [
  { icon: TableProperties, label: 'View a detailed history of all payouts to your account' },
  { icon: CalendarDays, label: 'See your upcoming payout schedule and expected amounts' },
  { icon: Landmark, label: 'Manage your connected bank account for receiving payouts' },
];

export const metadata: Metadata = {
  title: 'Payouts | FuzzyCat',
};

export default function ClinicPayoutsPage() {
  return (
    <div className="container mx-auto max-w-5xl px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payouts</h1>
        <p className="text-muted-foreground mt-1">
          Track your payout history and revenue earned through FuzzyCat.
        </p>
      </div>

      <Card>
        <CardHeader className="text-center pb-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Clock className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="mt-4">Coming Soon</CardTitle>
          <CardDescription>
            We're building your payout tracking dashboard. These features will be available shortly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {PLANNED_FEATURES.map((feature) => (
              <li key={feature.label} className="flex items-center gap-3 text-sm">
                <feature.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{feature.label}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
