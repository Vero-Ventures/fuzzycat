'use client';

import { Calendar, CreditCard, Landmark } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { Captcha } from '@/components/shared/captcha';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { PLATFORM_FEE_RATE } from '@/lib/constants';
import { formatCents } from '@/lib/utils/money';
import { calculatePaymentSchedule } from '@/lib/utils/schedule';
import { MathCaptcha } from './math-captcha';
import type { EnrollmentData } from './types';

interface StepReviewConfirmProps {
  data: EnrollmentData;
  updateData: (updates: Partial<EnrollmentData>) => void;
  onNext: () => void;
  onBack: () => void;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function StepReviewConfirm({ data, updateData, onNext, onBack }: StepReviewConfirmProps) {
  const schedule = useMemo(() => {
    try {
      return calculatePaymentSchedule(data.billAmountCents);
    } catch {
      return null;
    }
  }, [data.billAmountCents]);

  const handleTurnstileVerify = useCallback(
    (token: string) => {
      updateData({ captchaToken: token });
    },
    [updateData],
  );

  const handleTurnstileError = useCallback(() => {
    updateData({ captchaToken: null });
  }, [updateData]);

  const canContinue =
    data.disclaimersAccepted &&
    data.captchaVerified &&
    (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? !!data.captchaToken : true);

  function handleContinue() {
    if (canContinue) {
      onNext();
    }
  }

  if (!schedule) {
    return (
      <div className="py-8 text-center">
        <p className="text-destructive">
          Unable to calculate payment schedule. Please go back and check the bill amount.
        </p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Review Your Payment Plan</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Please review all details carefully before confirming. You will be redirected to make your
          deposit payment.
        </p>
      </div>

      {/* Clinic & Owner summary */}
      <div className="rounded-md border p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Clinic</p>
            <p className="font-medium">{data.clinicName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pet owner</p>
            <p className="font-medium">{data.ownerName}</p>
            <p className="text-sm text-muted-foreground">{data.ownerEmail}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pet</p>
            <p className="font-medium">{data.petName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Payment method</p>
            <div className="flex items-center gap-1.5">
              {data.paymentMethod === 'bank_account' ? (
                <Landmark className="h-4 w-4" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              <span className="font-medium">
                {data.paymentMethod === 'bank_account' ? 'Bank Account' : 'Debit Card'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment breakdown */}
      <div className="rounded-md border p-4">
        <h3 className="mb-3 font-semibold">Payment Breakdown</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Veterinary bill</span>
            <span className="font-medium">{formatCents(schedule.totalBillCents)}</span>
          </div>
          <div className="flex justify-between">
            <span>Platform fee ({PLATFORM_FEE_RATE * 100}%)</span>
            <span className="font-medium">{formatCents(schedule.feeCents)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatCents(schedule.totalWithFeeCents)}</span>
          </div>
        </div>
      </div>

      {/* Schedule */}
      <div className="rounded-md border p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Calendar className="h-4 w-4" />
          Payment Schedule
        </h3>

        <div className="space-y-2">
          {schedule.payments.map((payment) => (
            <div
              key={payment.sequenceNum}
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm odd:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <Badge variant={payment.type === 'deposit' ? 'default' : 'secondary'}>
                  {payment.type === 'deposit' ? 'Deposit' : `Payment ${payment.sequenceNum}`}
                </Badge>
                <span className="text-muted-foreground">{formatDate(payment.scheduledAt)}</span>
              </div>
              <span className="font-medium">{formatCents(payment.amountCents)}</span>
            </div>
          ))}
        </div>

        <Separator className="my-3" />
        <div className="flex justify-between text-base font-semibold">
          <span>Grand total</span>
          <span>{formatCents(schedule.totalWithFeeCents)}</span>
        </div>
      </div>

      {/* Disclaimers */}
      <div className="space-y-4 rounded-md border p-4">
        <h3 className="font-semibold">Disclosures & Acknowledgments</h3>

        <div className="flex items-start gap-3">
          <Checkbox
            id="disclaimers"
            checked={data.disclaimersAccepted}
            onCheckedChange={(checked) => {
              updateData({ disclaimersAccepted: checked === true });
            }}
          />
          <Label htmlFor="disclaimers" className="text-sm leading-relaxed font-normal">
            I understand and agree to the following:
            <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
              <li>
                A {PLATFORM_FEE_RATE * 100}% platform fee ({formatCents(schedule.feeCents)}) will be
                added to my vet bill
              </li>
              <li>
                A deposit of {formatCents(schedule.depositCents)} (25%) is due immediately via debit
                card
              </li>
              <li>
                {schedule.numInstallments} biweekly payments of{' '}
                {formatCents(schedule.installmentCents)} will be automatically charged
              </li>
              <li>
                Failed payments will be retried up to 3 times. Continued non-payment may result in
                my plan being marked as defaulted
              </li>
              <li>
                FuzzyCat is a payment facilitation platform. This is not a loan and no interest is
                charged
              </li>
            </ul>
          </Label>
        </div>
      </div>

      {/* CAPTCHA */}
      <div className="rounded-md border p-4">
        <h3 className="mb-3 font-semibold">Verification</h3>
        <div className="space-y-4">
          <MathCaptcha onVerified={(verified) => updateData({ captchaVerified: verified })} />
          <Captcha onVerify={handleTurnstileVerify} onError={handleTurnstileError} />
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleContinue} disabled={!canContinue} size="lg">
          Confirm &amp; Pay Deposit
        </Button>
      </div>
    </div>
  );
}
