import { Bell, Clock, CreditCard, UserPen } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const PLANNED_FEATURES = [
  { icon: UserPen, label: 'Edit your name, email, and phone number' },
  { icon: CreditCard, label: 'Manage your payment method (debit card or bank account)' },
  { icon: Bell, label: 'Set notification preferences for payment reminders' },
];

export const metadata: Metadata = {
  title: 'Settings | FuzzyCat',
};

export default function OwnerSettingsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your profile, payment method, and plan agreements.
        </p>
      </div>

      <Card>
        <CardHeader className="text-center pb-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Clock className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="mt-4">Coming Soon</CardTitle>
          <CardDescription>
            We're building your account settings experience. These features will be available
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
  );
}
