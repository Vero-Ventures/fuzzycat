import { CreditCard, FileText, Megaphone, Settings, UserPlus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Getting Started | FuzzyCat',
};

const STEPS = [
  {
    title: 'Complete your clinic profile',
    description:
      'Add your clinic name, address, and contact information so pet owners know who you are.',
    href: '/clinic/settings',
    icon: Settings,
  },
  {
    title: 'Connect your Stripe account',
    description:
      'Link your bank account via Stripe Connect to receive payouts from pet owner payment plans.',
    href: '/clinic/onboarding',
    icon: CreditCard,
  },
  {
    title: 'Enroll your first client',
    description:
      'Create a payment plan for a pet owner. Enter the vet bill amount and we handle the rest.',
    href: '/clinic/enroll',
    icon: UserPlus,
  },
  {
    title: 'Download front-desk materials',
    description:
      'Print waiting room flyers, quick reference cards, and pet owner info sheets for your team.',
    href: '/clinic/materials',
    icon: FileText,
  },
  {
    title: 'Invite other clinics',
    description:
      'Refer fellow clinics to FuzzyCat and earn a revenue share bonus for each clinic that joins.',
    href: '/clinic/referrals',
    icon: Megaphone,
  },
];

export default function GettingStartedPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Getting Started</h1>
        <p className="mt-1 text-muted-foreground">
          Follow these steps to set up your clinic and start offering payment plans to pet owners.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {STEPS.map((step, index) => (
          <Link key={step.href} href={step.href} className="block">
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="flex items-start gap-4 p-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <step.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">
                    Step {index + 1}: {step.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-lg border bg-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Need help? Use the feedback button in the bottom-right corner of any page to reach our
          team.
        </p>
      </div>
    </div>
  );
}
