import { CreditCard, HelpCircle, Plus, Settings } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const LINKS = [
  {
    label: 'Create New Plan',
    href: '/owner/enroll',
    icon: Plus,
    description: 'Start a new payment plan',
  },
  {
    label: 'My Plans',
    href: '/owner/plans',
    icon: CreditCard,
    description: 'View all your plans',
  },
  {
    label: 'Settings',
    href: '/owner/settings',
    icon: Settings,
    description: 'Manage your account',
  },
  {
    label: 'Help & Support',
    href: '/support',
    icon: HelpCircle,
    description: 'Get help with payments',
  },
];

export function QuickLinks() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick Links</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <link.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium">{link.label}</p>
              <p className="text-xs text-muted-foreground">{link.description}</p>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
