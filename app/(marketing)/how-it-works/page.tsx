import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Building2,
  Calendar,
  CreditCard,
  HandCoins,
  PawPrint,
  Shield,
  Stethoscope,
  Wallet,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CLINIC_SHARE_PERCENT, DEPOSIT_RATE, FEE_PERCENT, NUM_INSTALLMENTS } from '@/lib/constants';
import { PaymentCalculator } from './payment-calculator';

export const metadata: Metadata = {
  title: 'How It Works',
  description:
    'Learn how FuzzyCat payment plans work for clients and veterinary clinics. See payment examples, fee breakdowns, and frequently asked questions.',
  openGraph: {
    title: 'How It Works | FuzzyCat',
    description: 'Learn how FuzzyCat payment plans work for clients and veterinary clinics.',
  },
};

export default function HowItWorksPage() {
  const feePercent = FEE_PERCENT;
  const depositPercent = Math.round(DEPOSIT_RATE * 100);
  const clinicSharePercent = CLINIC_SHARE_PERCENT;

  return (
    <>
      {/* Page Header */}
      <section className="bg-gradient-to-b from-teal-50/50 to-background dark:from-teal-950/20 dark:to-background px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">How FuzzyCat Works</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            A simple, transparent way to pay veterinary bills in manageable installments.
          </p>
        </div>
      </section>

      {/* For Clients */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-sm">
              <PawPrint className="mr-1.5 h-3.5 w-3.5" />
              For Clients
            </Badge>
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight">
            Set up your payment plan in minutes
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            When your pet needs care, the last thing you want to worry about is how to pay. FuzzyCat
            lets you pay the bill in affordable biweekly installments with no credit check.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <OwnerStep
              step={1}
              icon={<Stethoscope className="h-5 w-5" />}
              title="Visit your vet"
              description="Get your treatment estimate from any FuzzyCat partner clinic."
            />
            <OwnerStep
              step={2}
              icon={<Wallet className="h-5 w-5" />}
              title="Enroll online"
              description={`Enter your bill amount. Connect your debit card or bank account. Review the full payment schedule.`}
            />
            <OwnerStep
              step={3}
              icon={<CreditCard className="h-5 w-5" />}
              title={`Pay ${depositPercent}% deposit`}
              description="Your deposit is charged immediately via debit card. Your plan is now active."
            />
            <OwnerStep
              step={4}
              icon={<Calendar className="h-5 w-5" />}
              title="Biweekly payments"
              description={`${NUM_INSTALLMENTS} equal payments are automatically deducted every 2 weeks. Done in 12 weeks.`}
            />
          </div>

          <div className="mt-10 rounded-xl border bg-muted/30 p-6">
            <h3 className="text-lg font-semibold">What you pay</h3>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  <strong className="text-foreground">Flat {feePercent}% platform fee</strong>{' '}
                  &mdash; added to your bill. This is the only cost. No interest.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  <strong className="text-foreground">{depositPercent}% deposit up front</strong>{' '}
                  &mdash; charged immediately via debit card.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  <strong className="text-foreground">
                    {NUM_INSTALLMENTS} biweekly installments
                  </strong>{' '}
                  &mdash; the remaining {100 - depositPercent}% is divided equally and deducted via
                  ACH every 2 weeks.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  <strong className="text-foreground">No credit check</strong> &mdash; your credit
                  score is never affected.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Interactive Calculator */}
      <section className="bg-muted/50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Try the payment calculator</h2>
            <p className="mt-3 text-muted-foreground">
              Enter your vet bill to see exactly what you would pay. No signup required.
            </p>
          </div>
          <PaymentCalculator />
        </div>
      </section>

      <Separator />

      {/* For Clinics */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-sm">
              <Building2 className="mr-1.5 h-3.5 w-3.5" />
              For Veterinary Clinics
            </Badge>
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight">
            Increase treatment acceptance. Earn revenue.
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            FuzzyCat is the only payment plan product that pays clinics a revenue share instead of
            charging them fees. Offer flexible payment options to your clients and earn a{' '}
            {clinicSharePercent}% revenue share on every enrollment.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <HandCoins className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">
                  Earn {clinicSharePercent}% on every enrollment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Other BNPL providers charge clinics 5-15% in merchant fees. FuzzyCat pays you{' '}
                  {clinicSharePercent}% of every enrollment as a platform administration fee. On a
                  $1,200 bill, that is $36 in your pocket.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Shield className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">Automated payment recovery</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  If a payment fails, FuzzyCat automatically retries with smart scheduling. We send
                  friendly reminders to clients and keep clinics informed throughout the process.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Banknote className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">Fast payouts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  After each successful installment, your payout is automatically transferred to
                  your bank account via Stripe Connect. Track everything from your dashboard.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 rounded-xl border bg-muted/30 p-6">
            <h3 className="text-lg font-semibold">How clinic payouts work</h3>
            <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  1
                </span>
                <span>Pet owner enrolls in a payment plan for a bill at your clinic.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  2
                </span>
                <span>
                  Each time a payment succeeds (deposit or installment), FuzzyCat initiates a payout
                  to your connected bank account.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  3
                </span>
                <span>
                  Your payout includes the proportional bill amount plus your {clinicSharePercent}%
                  revenue share.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  4
                </span>
                <span>
                  Track all plans, payments, and earnings from your FuzzyCat clinic dashboard.
                </span>
              </li>
            </ol>
          </div>

          <div className="mt-8 text-center">
            <Link href="/signup/clinic">
              <Button size="lg">
                Become a Partner Clinic
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t bg-muted/50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Ready to get started?</h2>
          <p className="mt-3 text-muted-foreground">
            Sign up in minutes. See your full payment schedule before you commit.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/signup/client">
              <Button size="lg" className="w-full sm:w-auto">
                Sign Up as Client
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/signup/clinic">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Register Your Clinic
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function OwnerStep({
  step,
  icon,
  title,
  description,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <span className="text-xs font-semibold text-muted-foreground">Step {step}</span>
      <h3 className="mt-1 text-base font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
