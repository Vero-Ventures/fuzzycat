'use client';

import { useMutation } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useTRPC } from '@/lib/trpc/client';
import { formatCents } from '@/lib/utils/money';
import { calculatePaymentSchedule } from '@/lib/utils/schedule';
import type { EnrollmentData } from '../page';

interface StepDepositPaymentProps {
  data: EnrollmentData;
  onBack: () => void;
}

export function StepDepositPayment({ data, onBack }: StepDepositPaymentProps) {
  const [planId, setPlanId] = useState<string | null>(data.planId);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trpc = useTRPC();

  const schedule = useMemo(() => {
    try {
      return calculatePaymentSchedule(data.billAmountCents);
    } catch {
      return null;
    }
  }, [data.billAmountCents]);

  const createEnrollment = useMutation(
    trpc.enrollment.create.mutationOptions({
      onSuccess: (result) => {
        setPlanId(result.planId);
      },
      onError: (err) => {
        setError(err.message || 'Failed to create enrollment. Please try again.');
      },
    }),
  );

  const initiateDeposit = useMutation(
    trpc.payment.initiateDeposit.mutationOptions({
      onSuccess: (result) => {
        if (result.sessionUrl) {
          setCheckoutUrl(result.sessionUrl);
          window.location.href = result.sessionUrl;
        }
      },
      onError: (err) => {
        setError(err.message || 'Failed to create checkout session. Please try again.');
      },
    }),
  );

  const isProcessing = createEnrollment.isPending || initiateDeposit.isPending;

  function handlePayDeposit() {
    setError(null);

    if (!planId) {
      // Step 1: Create the enrollment first
      createEnrollment.mutate(
        {
          clinicId: data.clinicId,
          ownerData: {
            name: data.ownerName,
            email: data.ownerEmail,
            phone: data.ownerPhone,
            petName: data.petName,
            paymentMethod: data.paymentMethod,
          },
          billAmountCents: data.billAmountCents,
        },
        {
          onSuccess: (result) => {
            // Step 2: Initiate deposit checkout
            initiateDeposit.mutate({
              planId: result.planId,
              successUrl: `${window.location.origin}/owner/enroll/success?planId=${result.planId}`,
              cancelUrl: `${window.location.origin}/owner/enroll?step=5&cancelled=true`,
            });
          },
        },
      );
    } else {
      // Already have a plan, just initiate deposit
      initiateDeposit.mutate({
        planId,
        successUrl: `${window.location.origin}/owner/enroll/success?planId=${planId}`,
        cancelUrl: `${window.location.origin}/owner/enroll?step=5&cancelled=true`,
      });
    }
  }

  if (checkoutUrl) {
    return (
      <div className="space-y-6 py-8 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <div>
          <h2 className="text-xl font-semibold">Redirecting to Stripe Checkout</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You are being redirected to our secure payment page. If you are not redirected
            automatically, please{' '}
            <a href={checkoutUrl} className="text-primary underline">
              click here
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Pay Your Deposit</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your deposit will be charged immediately via debit card through Stripe, our secure payment
          processor. Once paid, your payment plan becomes active.
        </p>
      </div>

      {schedule && (
        <div className="rounded-md border bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Deposit amount (25%)</p>
              <p className="text-2xl font-bold">{formatCents(schedule.depositCents)}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-primary/30" />
          </div>
          <Separator className="my-3" />
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              Remaining: {formatCents(schedule.remainingCents)} in {schedule.numInstallments}{' '}
              biweekly payments
            </p>
            <p>Each installment: {formatCents(schedule.installmentCents)}</p>
          </div>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border bg-muted/30 p-4">
        <h3 className="mb-2 text-sm font-medium">What happens next</h3>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
              1
            </span>
            You will be redirected to Stripe to enter your debit card details
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
              2
            </span>
            Your deposit will be charged immediately
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
              3
            </span>
            Your payment plan becomes active and your clinic will be notified
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
              4
            </span>
            Biweekly installments begin automatically in 14 days
          </li>
        </ol>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isProcessing}>
          Back
        </Button>
        <Button onClick={handlePayDeposit} disabled={isProcessing} size="lg">
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            `Pay Deposit${schedule ? ` ${formatCents(schedule.depositCents)}` : ''}`
          )}
        </Button>
      </div>
    </div>
  );
}
