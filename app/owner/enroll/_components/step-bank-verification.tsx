'use client';

import { CreditCard } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { EnrollmentData } from './types';

interface StepBankVerificationProps {
  data: EnrollmentData;
  updateData: (updates: Partial<EnrollmentData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepBankVerification({
  data,
  updateData,
  onNext,
  onBack,
}: StepBankVerificationProps) {
  const [_connectionError, setConnectionError] = useState<string | null>(null);

  function handleDebitCardChoice() {
    updateData({ paymentMethod: 'debit_card' });
    setConnectionError(null);
  }

  function handleContinue() {
    if (data.paymentMethod === 'debit_card') {
      onNext();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Payment Method</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how you would like to make your payments. Your deposit will be charged via debit
          card at checkout.
        </p>
      </div>

      <Alert>
        <AlertTitle>Bank account payments coming soon</AlertTitle>
        <AlertDescription>
          ACH bank account payments will be available in a future update. For now, please use a
          debit card for all payments.
        </AlertDescription>
      </Alert>

      <Separator />

      {/* Debit card option */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Debit Card</h3>
        <p className="text-xs text-muted-foreground">
          Pay all installments with your debit card. Your card will be charged at Stripe checkout.
        </p>
        <Button
          variant={data.paymentMethod === 'debit_card' ? 'default' : 'outline'}
          size="lg"
          className="w-full justify-start gap-3 h-auto py-4"
          onClick={handleDebitCardChoice}
        >
          <CreditCard className="h-5 w-5" />
          <div className="text-left">
            <p className="font-medium">Use debit card</p>
            <p className="text-xs text-muted-foreground">
              Deposit and all installments charged to your debit card
            </p>
          </div>
        </Button>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleContinue} disabled={data.paymentMethod !== 'debit_card'} size="lg">
          Continue
        </Button>
      </div>
    </div>
  );
}
