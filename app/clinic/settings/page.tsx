import { Building2, Clock, CreditCard, Shield, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const PLANNED_FEATURES = [
  { icon: Building2, label: 'Edit clinic name, address, and contact information' },
  { icon: CreditCard, label: 'Manage your Stripe Connect payout account' },
  { icon: Users, label: 'Add and manage staff accounts' },
  { icon: Shield, label: 'Configure security and authentication settings' },
];

export const metadata: Metadata = {
  title: 'Clinic Settings | FuzzyCat',
};

export default function ClinicSettingsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clinic Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your clinic information, payment account, and security.
        </p>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader className="text-center pb-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="mt-4">Coming Soon</CardTitle>
            <CardDescription>
              We're building your clinic settings dashboard. These features will be available
              shortly.
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
    </div>
  );
}
