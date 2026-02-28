'use client';

import { AlertCircle, Calendar } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { MIN_BILL_CENTS, PLATFORM_FEE_RATE } from '@/lib/constants';
import { formatCents, toCents } from '@/lib/utils/money';
import { calculatePaymentSchedule } from '@/lib/utils/schedule';
import type { EnrollmentData } from './types';

export const billDetailsSchema = z.object({
  billAmountCents: z
    .number()
    .int()
    .min(MIN_BILL_CENTS, `Minimum bill is $${MIN_BILL_CENTS / 100}`),
  ownerName: z.string().trim().min(1, 'Name is required'),
  ownerEmail: z.string().email('Valid email is required'),
  ownerPhone: z.string().trim().min(1, 'Phone is required'),
  petName: z.string().trim().min(1, 'Pet name is required'),
});

interface StepBillDetailsProps {
  data: EnrollmentData;
  updateData: (updates: Partial<EnrollmentData>) => void;
  onNext: () => void;
  onBack: () => void;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function StepBillDetails({ data, updateData, onNext, onBack }: StepBillDetailsProps) {
  const [billDollars, setBillDollars] = useState(
    data.billAmountCents > 0 ? (data.billAmountCents / 100).toString() : '',
  );
  const [ownerName, setOwnerName] = useState(data.ownerName);
  const [ownerEmail, setOwnerEmail] = useState(data.ownerEmail);
  const [ownerPhone, setOwnerPhone] = useState(data.ownerPhone);
  const [petName, setPetName] = useState(data.petName);
  const [touched, setTouched] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const billAmountCents = useMemo(() => {
    const parsed = Number.parseFloat(billDollars);
    if (Number.isNaN(parsed) || parsed < 0) return 0;
    return toCents(parsed);
  }, [billDollars]);

  const isBelowMinimum = billAmountCents > 0 && billAmountCents < MIN_BILL_CENTS;
  const isValidAmount = billAmountCents >= MIN_BILL_CENTS;

  // Debounce schedule calculation to avoid blocking the main thread on every keystroke.
  // The schedule involves date arithmetic that is expensive on mobile CPUs.
  const [schedule, setSchedule] = useState<ReturnType<typeof calculatePaymentSchedule> | null>(
    null,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isValidAmount) {
      setSchedule(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        setSchedule(calculatePaymentSchedule(billAmountCents));
      } catch {
        setSchedule(null);
      }
    }, 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [billAmountCents, isValidAmount]);

  const isFormValid =
    isValidAmount &&
    ownerName.trim().length > 0 &&
    ownerEmail.trim().length > 0 &&
    ownerPhone.trim().length > 0 &&
    petName.trim().length > 0;

  function handleContinue() {
    setTouched(true);

    const result = billDetailsSchema.safeParse({
      billAmountCents,
      ownerName,
      ownerEmail,
      ownerPhone,
      petName,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string' && !errors[field]) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    if (!schedule) return;
    updateData({
      billAmountCents: result.data.billAmountCents,
      ownerName: result.data.ownerName,
      ownerEmail: result.data.ownerEmail,
      ownerPhone: result.data.ownerPhone,
      petName: result.data.petName,
    });
    onNext();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Bill Details & Your Information</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the total vet bill and your contact information. We will calculate your payment
          schedule.
        </p>
      </div>

      {/* Bill amount */}
      <div className="space-y-2">
        <Label htmlFor="bill-amount">Total veterinary bill</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            id="bill-amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="1,200.00"
            value={billDollars}
            onChange={(e) => setBillDollars(e.target.value)}
            className="pl-7"
          />
        </div>
        {isBelowMinimum && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Minimum bill amount is {formatCents(MIN_BILL_CENTS)}. FuzzyCat is designed for
              significant veterinary expenses such as emergencies, surgeries, and multi-visit
              treatment plans.
            </AlertDescription>
          </Alert>
        )}
        <p className="text-xs text-muted-foreground">
          A flat {PLATFORM_FEE_RATE * 100}% fee will be added. No hidden charges, no interest.
        </p>
      </div>

      {/* Owner info */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="owner-name">Your full name</Label>
          <Input
            id="owner-name"
            placeholder="Jane Smith"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />
          {touched && fieldErrors.ownerName && (
            <p className="text-xs text-destructive">{fieldErrors.ownerName}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="pet-name">Pet name</Label>
          <Input
            id="pet-name"
            placeholder="Whiskers"
            value={petName}
            onChange={(e) => setPetName(e.target.value)}
          />
          {touched && fieldErrors.petName && (
            <p className="text-xs text-destructive">{fieldErrors.petName}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="owner-email">Email</Label>
          <Input
            id="owner-email"
            type="email"
            placeholder="jane@example.com"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
          />
          {touched && fieldErrors.ownerEmail && (
            <p className="text-xs text-destructive">{fieldErrors.ownerEmail}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="owner-phone">Phone number</Label>
          <Input
            id="owner-phone"
            type="tel"
            placeholder="(555) 123-4567"
            value={ownerPhone}
            onChange={(e) => setOwnerPhone(e.target.value)}
          />
          {touched && fieldErrors.ownerPhone && (
            <p className="text-xs text-destructive">{fieldErrors.ownerPhone}</p>
          )}
        </div>
      </div>

      {/* Payment schedule preview */}
      {schedule && (
        <div className="rounded-md border bg-muted/30 p-4">
          <h3 className="mb-3 font-semibold">Your Payment Schedule</h3>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Vet bill</span>
              <span className="font-medium">{formatCents(schedule.totalBillCents)}</span>
            </div>
            <div className="flex justify-between">
              <span>Platform fee ({PLATFORM_FEE_RATE * 100}%)</span>
              <span className="font-medium">{formatCents(schedule.feeCents)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total with fee</span>
              <span>{formatCents(schedule.totalWithFeeCents)}</span>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between rounded-md bg-primary/10 p-2">
              <span className="font-medium">Deposit (25%) - due today</span>
              <span className="font-semibold">{formatCents(schedule.depositCents)}</span>
            </div>

            <p className="flex items-center gap-1 pt-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {schedule.numInstallments} biweekly installments of{' '}
              {formatCents(schedule.installmentCents)}
            </p>

            <div className="max-h-48 space-y-1 overflow-y-auto">
              {schedule.payments
                .filter((p) => p.type === 'installment')
                .map((payment) => (
                  <div
                    key={payment.sequenceNum}
                    className="flex justify-between rounded px-2 py-1 text-xs odd:bg-muted/50"
                  >
                    <span>
                      Payment {payment.sequenceNum} - {formatDate(payment.scheduledAt)}
                    </span>
                    <span>{formatCents(payment.amountCents)}</span>
                  </div>
                ))}
            </div>

            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Grand total</span>
              <span>{formatCents(schedule.totalWithFeeCents)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleContinue} disabled={!isFormValid} size="lg">
          Continue
        </Button>
      </div>
    </div>
  );
}
