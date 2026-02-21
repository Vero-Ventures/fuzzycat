'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTRPC } from '@/lib/trpc/client';

export function StripeReturnContent() {
  const trpc = useTRPC();
  const {
    data: status,
    isLoading,
    error,
  } = useQuery(trpc.clinic.getOnboardingStatus.queryOptions());

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-9 w-40" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to check account status</AlertTitle>
        <AlertDescription>
          Something went wrong. Please return to the onboarding page and try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (!status) return null;

  const stripeActive = status.stripe.status === 'active';
  const stripePending = status.stripe.status === 'pending';

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {stripeActive
            ? 'Stripe Setup Complete'
            : stripePending
              ? 'Stripe Verification In Progress'
              : 'Stripe Setup Incomplete'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {stripeActive ? (
          <>
            <p className="text-sm text-muted-foreground">
              Your Stripe account is verified and ready to receive payments. You can now continue
              with the remaining onboarding steps.
            </p>
            <Button asChild>
              <Link href="/clinic/onboarding">Continue Onboarding</Link>
            </Button>
          </>
        ) : stripePending ? (
          <>
            <p className="text-sm text-muted-foreground">
              Stripe is reviewing your account information. This typically takes a few minutes but
              may take up to 24 hours. You will be notified when verification is complete.
            </p>
            <p className="text-sm text-muted-foreground">
              You can continue setting up the remaining onboarding steps in the meantime.
            </p>
            <Button asChild>
              <Link href="/clinic/onboarding">Back to Onboarding</Link>
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              It looks like the Stripe setup was not completed. Please return to the onboarding page
              to try again.
            </p>
            <Button asChild>
              <Link href="/clinic/onboarding">Back to Onboarding</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
