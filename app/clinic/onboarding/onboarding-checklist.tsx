'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useTRPC } from '@/lib/trpc/client';

// ── Types ────────────────────────────────────────────────────────────

interface OnboardingStatus {
  clinicId: string;
  clinicName: string;
  clinicStatus: string;
  profileComplete: boolean;
  stripe: {
    status: 'not_started' | 'pending' | 'active';
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    accountId: string | null;
  };
  mfaEnabled: boolean;
  allComplete: boolean;
}

interface StripeMutation {
  mutate: () => void;
  isPending: boolean;
  error: { message: string } | null;
}

interface CompleteMutation {
  mutate: () => void;
  isPending: boolean;
  error: { message: string } | null;
}

// ── Sub-components ───────────────────────────────────────────────────

function StepStatus({ complete }: { complete: boolean }) {
  if (complete) {
    return (
      <Badge
        variant="default"
        className="bg-green-600 hover:bg-green-600 dark:bg-green-500 dark:hover:bg-green-500"
      >
        Complete
      </Badge>
    );
  }
  return <Badge variant="outline">Pending</Badge>;
}

function OnboardingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-9 w-36" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ProgressBar({ status }: { status: OnboardingStatus }) {
  const stripeComplete = status.stripe.status === 'active';
  const steps = [
    { key: 'profile', complete: status.profileComplete },
    { key: 'stripe', complete: stripeComplete },
    { key: 'mfa', complete: status.mfaEnabled },
  ];
  const completedSteps = steps.filter((s) => s.complete).length;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{completedSteps} of 3 steps completed</p>
          <div className="flex gap-1.5">
            {steps.map((step) => (
              <div
                key={step.key}
                className={`h-2 w-8 rounded-full ${step.complete ? 'bg-green-500 dark:bg-green-400' : 'bg-muted'}`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileStep({ complete }: { complete: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">1. Complete your profile</CardTitle>
          <StepStatus complete={complete} />
        </div>
        <CardDescription>Add your clinic address to help pet owners find you.</CardDescription>
      </CardHeader>
      <CardContent>
        {complete ? (
          <p className="text-sm text-muted-foreground">
            Your profile is complete. You can update your information in{' '}
            <Link href="/clinic/settings" className="text-primary underline underline-offset-4">
              settings
            </Link>
            .
          </p>
        ) : (
          <Button variant="outline" asChild>
            <Link href="/clinic/settings">Complete Profile</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function StripeStep({ status, mutation }: { status: OnboardingStatus; mutation: StripeMutation }) {
  const stripeComplete = status.stripe.status === 'active';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">2. Connect your bank account</CardTitle>
          <StepStatus complete={stripeComplete} />
        </div>
        <CardDescription>
          Set up Stripe Connect to receive payments from pet owners. This is a one-time setup that
          takes about 5 minutes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <StripeStepContent status={status} mutation={mutation} />
        {mutation.error && (
          <p className="mt-2 text-sm text-destructive">{mutation.error.message}</p>
        )}
      </CardContent>
    </Card>
  );
}

function StripeStepContent({
  status,
  mutation,
}: {
  status: OnboardingStatus;
  mutation: StripeMutation;
}) {
  if (status.stripe.status === 'active') {
    return (
      <p className="text-sm text-muted-foreground">
        Your Stripe account is verified and ready to receive payments.
      </p>
    );
  }

  if (status.stripe.status === 'pending') {
    return (
      <div className="space-y-3">
        <Alert>
          <AlertTitle>Verification in progress</AlertTitle>
          <AlertDescription>
            Stripe is reviewing your account. This usually takes a few minutes but may take up to 24
            hours. You can continue Stripe setup if you have remaining steps.
          </AlertDescription>
        </Alert>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Preparing...' : 'Continue Stripe Setup'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        You will be redirected to Stripe to verify your identity and connect your bank account.
        FuzzyCat never stores your bank details directly.
      </p>
      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? 'Preparing...' : 'Start Stripe Setup'}
      </Button>
    </div>
  );
}

function MfaStep({ enabled }: { enabled: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">3. Enable two-factor authentication</CardTitle>
          <StepStatus complete={enabled} />
        </div>
        <CardDescription>
          MFA is required for all clinic accounts to protect sensitive payment data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {enabled ? (
          <p className="text-sm text-muted-foreground">
            Two-factor authentication is enabled on your account.
          </p>
        ) : (
          <Button variant="outline" asChild>
            <Link href="/mfa/setup">Set Up MFA</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function OnboardingFooter({
  status,
  mutation,
}: {
  status: OnboardingStatus;
  mutation: CompleteMutation;
}) {
  if (status.clinicStatus === 'active') {
    return (
      <div className="text-center">
        <p className="text-sm font-medium text-green-600 dark:text-green-400">
          Your clinic is active and ready to accept payment plans.
        </p>
        <Button className="mt-3" asChild>
          <Link href="/clinic/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    );
  }

  if (status.allComplete) {
    return (
      <div className="text-center">
        <p className="mb-3 text-sm text-muted-foreground">
          All steps are complete. Activate your clinic to start accepting payment plans.
        </p>
        <Button size="lg" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Activating...' : 'Activate Clinic'}
        </Button>
        {mutation.error && (
          <p className="mt-2 text-sm text-destructive">{mutation.error.message}</p>
        )}
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      Complete all steps above to activate your clinic.
    </p>
  );
}

// ── Main checklist component ─────────────────────────────────────────

export function OnboardingChecklist() {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: status,
    isLoading,
    error,
  } = useQuery(trpc.clinic.getOnboardingStatus.queryOptions());

  const stripeMutation = useMutation(
    trpc.clinic.startStripeOnboarding.mutationOptions({
      onSuccess: (data) => {
        window.location.href = data.url;
      },
    }),
  );

  const completeMutation = useMutation(
    trpc.clinic.completeOnboarding.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.clinic.getOnboardingStatus.queryKey(),
        });
        router.push('/clinic/dashboard');
      },
    }),
  );

  if (isLoading) {
    return <OnboardingSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load onboarding status</AlertTitle>
        <AlertDescription>
          Something went wrong. Please refresh the page and try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (!status) return null;

  return (
    <div className="space-y-6">
      <ProgressBar status={status} />
      <ProfileStep complete={status.profileComplete} />
      <Separator />
      <StripeStep status={status} mutation={stripeMutation} />
      <Separator />
      <MfaStep enabled={status.mfaEnabled} />
      <Separator />
      <div className="flex flex-col items-center gap-3 pt-2 pb-4">
        <OnboardingFooter status={status} mutation={completeMutation} />
      </div>
    </div>
  );
}
