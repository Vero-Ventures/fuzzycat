import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Cat,
  HandCoins,
  Heart,
  PawPrint,
  Shield,
  Stethoscope,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  CLINIC_SHARE_RATE,
  DEPOSIT_RATE,
  NUM_INSTALLMENTS,
  PLATFORM_FEE_RATE,
} from '@/lib/constants';

export const metadata: Metadata = {
  title: 'FuzzyCat - Guaranteed Payment Plans for Veterinary Care',
  description:
    'Pay your vet bill in easy biweekly installments over 12 weeks. No credit check. Flat 6% fee. Clinics earn 3% on every enrollment. Guaranteed payment plans for veterinary care.',
  openGraph: {
    title: 'FuzzyCat - Guaranteed Payment Plans for Veterinary Care',
    description:
      'Pay your vet bill in easy biweekly installments. No credit check. No hidden fees.',
    type: 'website',
  },
};

export default function LandingPage() {
  const feePercent = Math.round(PLATFORM_FEE_RATE * 100);
  const depositPercent = Math.round(DEPOSIT_RATE * 100);
  const clinicSharePercent = Math.round(CLINIC_SHARE_RATE * 100);

  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-amber-50/50 to-background dark:from-amber-950/20 dark:to-background px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
        <div className="absolute inset-0 -z-10 opacity-[0.03]">
          <div className="absolute left-1/4 top-1/4">
            <PawPrint className="h-32 w-32 rotate-12" />
          </div>
          <div className="absolute bottom-1/4 right-1/3">
            <PawPrint className="h-24 w-24 -rotate-12" />
          </div>
          <div className="absolute right-1/4 top-1/3">
            <PawPrint className="h-20 w-20 rotate-45" />
          </div>
        </div>
        <div className="mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-6 text-sm">
            <Cat className="mr-1.5 h-3.5 w-3.5" />
            No credit check required
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Your pet deserves care.
            <br />
            <span className="text-amber-600 dark:text-amber-400">
              You deserve a fair payment plan.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Pay your vet bill in {NUM_INSTALLMENTS} easy biweekly installments over 12 weeks. Just a
            flat {feePercent}% fee &mdash; no interest, no credit check, no surprises.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/signup">
              <Button size="lg" className="w-full sm:w-auto">
                Start My Payment Plan
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/how-it-works">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                See How It Works
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works - 3 Steps */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Three steps to peace of mind
            </h2>
            <p className="mt-3 text-muted-foreground">
              From enrollment to final payment, the process is simple and transparent.
            </p>
          </div>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            <StepCard
              step={1}
              title="Enroll online"
              description={`Enter your vet bill amount and connect your debit card or bank account. Pay a ${depositPercent}% deposit to get started.`}
              icon={<PawPrint className="h-6 w-6" />}
            />
            <StepCard
              step={2}
              title="Automatic payments"
              description={`The remaining balance is paid in ${NUM_INSTALLMENTS} biweekly installments, automatically deducted every two weeks.`}
              icon={<Banknote className="h-6 w-6" />}
            />
            <StepCard
              step={3}
              title="Done in 12 weeks"
              description="Your plan is complete. No lingering debt, no surprise charges, no interest compounding."
              icon={<BadgeCheck className="h-6 w-6" />}
            />
          </div>
        </div>
      </section>

      {/* Fee Transparency Section */}
      <section className="bg-muted/50 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Transparent pricing. No tricks.
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              One flat fee. That is it. We believe you deserve to know exactly what you are paying
              before you commit.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
                  <Shield className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg">Flat {feePercent}% Fee</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center">
                  A {feePercent}% platform fee is added to your vet bill. This is the only cost. No
                  interest, no hidden charges, no late fees that compound.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
                  <BadgeCheck className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg">No Credit Check</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center">
                  We do not run credit checks. Your credit score is not affected. All you need is a
                  debit card or bank account.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
                  <Heart className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg">12-Week Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center">
                  Pay {depositPercent}% up front, then {NUM_INSTALLMENTS} equal biweekly payments.
                  Your plan is complete in 12 weeks. No rolling debt.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
          <div className="mt-10 text-center">
            <Link href="/how-it-works">
              <Button variant="link" className="text-amber-700 dark:text-amber-400">
                See a detailed payment example
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Clinic CTA Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 shadow-lg">
            <div className="px-8 py-14 sm:px-14">
              <div className="grid items-center gap-8 md:grid-cols-2">
                <div>
                  <Badge
                    variant="secondary"
                    className="mb-4 bg-white/20 text-white hover:bg-white/30"
                  >
                    <Stethoscope className="mr-1.5 h-3.5 w-3.5" />
                    For Veterinary Clinics
                  </Badge>
                  <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    Get paid to offer payment plans
                  </h2>
                  <p className="mt-4 text-lg text-amber-100">
                    FuzzyCat is the only payment plan that pays clinics a {clinicSharePercent}%
                    revenue share on every enrollment. Increase treatment acceptance, earn more
                    revenue, and never absorb default risk.
                  </p>
                </div>
                <div className="space-y-4">
                  <ClinicBenefit
                    icon={<HandCoins className="h-5 w-5" />}
                    title={`Earn ${clinicSharePercent}% on every plan`}
                    description="No other BNPL product pays clinics. They charge you. We pay you."
                  />
                  <ClinicBenefit
                    icon={<Shield className="h-5 w-5" />}
                    title="Guaranteed payment"
                    description="If a pet owner defaults, FuzzyCat's risk pool covers your payout."
                  />
                  <ClinicBenefit
                    icon={<BadgeCheck className="h-5 w-5" />}
                    title="Zero setup cost"
                    description="No merchant fees, no hardware, no contracts. Start in minutes."
                  />
                  <div className="pt-2">
                    <Link href="/signup">
                      <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                        Partner With FuzzyCat
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pet Owner CTA */}
      <section className="border-t bg-muted/50 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Cat className="mx-auto mb-6 h-12 w-12 text-amber-600 dark:text-amber-400" />
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to make vet care affordable?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Sign up in minutes. No credit check. See your full payment schedule before you commit.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/signup">
              <Button size="lg" className="w-full sm:w-auto">
                Get Started
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/how-it-works">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Separator />
    </>
  );
}

function StepCard({
  step,
  title,
  description,
  icon,
}: {
  step: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="relative rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
          {icon}
        </div>
        <span className="text-sm font-semibold text-muted-foreground">Step {step}</span>
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ClinicBenefit({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="text-sm text-amber-100">{description}</p>
      </div>
    </div>
  );
}
