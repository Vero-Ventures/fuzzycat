import { eq } from 'drizzle-orm';
import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  CreditCard,
  PawPrint,
  Shield,
  Stethoscope,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DEPOSIT_RATE, FEE_PERCENT, NUM_INSTALLMENTS } from '@/lib/constants';
import { db } from '@/server/db';
import { clinics } from '@/server/db/schema';

interface PageProps {
  params: Promise<{ clinicId: string }>;
}

async function getClinicPublicInfo(clinicId: string) {
  const [clinic] = await db
    .select({ id: clinics.id, name: clinics.name })
    .from(clinics)
    .where(eq(clinics.id, clinicId))
    .limit(1);
  return clinic ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { clinicId } = await params;
  const clinic = await getClinicPublicInfo(clinicId);
  const clinicName = clinic?.name ?? 'Your Veterinarian';
  return {
    title: `${clinicName} - Pay Your Vet Bill Over Time`,
    description: `Your pet needs care now. ${clinicName} partners with FuzzyCat so you can pay over time. No credit check, no interest.`,
  };
}

export default async function ClinicEnrollLandingPage({ params }: PageProps) {
  const { clinicId } = await params;
  const clinic = await getClinicPublicInfo(clinicId);

  if (!clinic) {
    notFound();
  }

  const feePercent = FEE_PERCENT;
  const depositPercent = Math.round(DEPOSIT_RATE * 100);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-teal-50/50 to-background px-4 py-16 dark:from-teal-950/20 dark:to-background sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary" className="mb-6 text-sm">
            <Stethoscope className="mr-1.5 h-3.5 w-3.5" />
            {clinic.name}
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Your Pet Needs Care Now.
            <br />
            <span className="text-primary italic">The Bill Can Wait.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            {clinic.name} partners with FuzzyCat so you can pay your vet bill over time. No credit
            check, no interest &mdash; just a debit card or bank account.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            How It Works
          </h2>
          <p className="mt-3 text-center text-muted-foreground">
            Three simple steps to make your vet bill manageable.
          </p>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <StepCard
              step={1}
              icon={<PawPrint className="h-6 w-6" />}
              title="Your clinic enrolls you"
              description="Your vet enters your bill into FuzzyCat. You receive an email with your personalized payment plan."
            />
            <StepCard
              step={2}
              icon={<CreditCard className="h-6 w-6" />}
              title="Pay a small deposit"
              description="Securely connect a debit card or bank account. A deposit activates your plan immediately."
            />
            <StepCard
              step={3}
              icon={<Calendar className="h-6 w-6" />}
              title="Done in 12 weeks"
              description="The rest is split into easy biweekly payments, automatically deducted. No lingering debt."
            />
          </div>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="bg-muted/50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Care first, cost second
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <BenefitCard
              icon={<Stethoscope className="h-5 w-5" />}
              title="Get care today"
              description="Don't delay treatment because of cost. Start a plan and get your pet what they need now."
            />
            <BenefitCard
              icon={<Shield className="h-5 w-5" />}
              title="No credit check"
              description="Your credit score is never pulled or affected. All you need is a debit card or bank account."
            />
            <BenefitCard
              icon={<BadgeCheck className="h-5 w-5" />}
              title="No interest, ever"
              description="Just a small flat fee. No compounding charges, no hidden costs."
            />
            <BenefitCard
              icon={<Calendar className="h-5 w-5" />}
              title="Know what you owe"
              description="See your exact payment dates and amounts before you commit. No surprises."
            />
          </div>
        </div>
      </section>

      {/* Example Breakdown */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-lg">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Example Payment Plan
          </h2>
          <p className="mt-3 text-center text-muted-foreground">
            Here&apos;s what a $2,000 vet bill looks like with FuzzyCat.
          </p>
          <Card className="mt-8">
            <CardContent className="space-y-3 p-6 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vet bill</span>
                <span className="font-medium">$2,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform fee ({feePercent}%)</span>
                <span className="font-medium">$160</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>$2,160</span>
              </div>
              <Separator />
              <div className="flex justify-between text-primary">
                <span>Deposit ({depositPercent}%)</span>
                <span className="font-medium">$540 today</span>
              </div>
              <div className="flex justify-between text-primary">
                <span>{NUM_INSTALLMENTS} biweekly payments</span>
                <span className="font-medium">$270 each</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <PawPrint className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Don&apos;t put off the care your pet needs
          </h2>
          <p className="mt-3 text-muted-foreground">
            Ask the front desk at {clinic.name} to enroll you, or create a FuzzyCat account to get
            started.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/signup/client">
              <Button size="lg" className="w-full sm:w-auto">
                Create Account
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/how-it-works">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Learn More
              </Button>
            </Link>
          </div>
          <p className="mx-auto mt-6 max-w-lg text-xs text-muted-foreground">
            By enrolling, you authorize FuzzyCat to debit your account on the scheduled dates.
            Overdraft fees or bank charges from failed debits are your responsibility.{' '}
            <Link href="/terms" className="underline hover:text-foreground">
              Terms of Service
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}

function StepCard({
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
    <div className="relative rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
          {step}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function BenefitCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
