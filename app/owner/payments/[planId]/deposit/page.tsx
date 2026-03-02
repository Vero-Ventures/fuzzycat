'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, CreditCard, Loader2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useTRPC } from '@/lib/trpc/client';
import { formatCents } from '@/lib/utils/money';

export default function DepositPaymentPage() {
  const params = useParams<{ planId: string }>();
  const planId = params.planId;
  const router = useRouter();
  const trpc = useTRPC();

  const summaryQuery = useQuery(
    trpc.enrollment.getSummary.queryOptions({ planId }, { enabled: !!planId }),
  );

  const initiateDeposit = useMutation(
    trpc.payment.initiateDeposit.mutationOptions({
      onSuccess: (data) => {
        window.location.href = data.sessionUrl;
      },
    }),
  );

  const summary = summaryQuery.data;
  const plan = summary?.plan;

  if (summaryQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (summaryQuery.isError || !plan) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to load plan</AlertTitle>
          <AlertDescription>
            This payment plan could not be found or you do not have access to it.
          </AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/owner/payments')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (plan.status !== 'pending') {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Deposit already paid</AlertTitle>
          <AlertDescription>
            This payment plan is already {plan.status}. No deposit payment is needed.
          </AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/owner/payments')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  function handlePayDeposit() {
    initiateDeposit.mutate({
      planId,
      successUrl: `${window.location.origin}/owner/payments`,
      cancelUrl: `${window.location.origin}/owner/payments/${planId}/deposit`,
    });
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <CreditCard className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Pay Your Deposit</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A 25% deposit is required to activate your payment plan.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Clinic</span>
              <span className="font-medium">{summary.clinic?.name ?? 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pet</span>
              <span className="font-medium">{summary.owner?.petName ?? 'N/A'}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vet Bill</span>
              <span className="font-medium">{formatCents(plan.totalBillCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform Fee (6%)</span>
              <span className="font-medium">{formatCents(plan.feeCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium">{formatCents(plan.totalWithFeeCents)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-semibold">
              <span>Deposit Due Now</span>
              <span>{formatCents(plan.depositCents)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {initiateDeposit.isError && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Payment failed</AlertTitle>
          <AlertDescription>
            {initiateDeposit.error.message || 'Unable to start deposit payment. Please try again.'}
          </AlertDescription>
        </Alert>
      )}

      <Button
        onClick={handlePayDeposit}
        disabled={initiateDeposit.isPending}
        size="lg"
        className="mt-6 w-full"
      >
        {initiateDeposit.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirecting to Checkout...
          </>
        ) : (
          `Pay ${formatCents(plan.depositCents)} Deposit`
        )}
      </Button>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        You will be redirected to Stripe for secure payment processing.
      </p>
    </div>
  );
}
