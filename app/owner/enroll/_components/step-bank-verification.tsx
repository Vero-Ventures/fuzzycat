'use client';

import { useMutation } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, CreditCard } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useTRPC } from '@/lib/trpc/client';
import { PlaidLinkButton } from './plaid-link-button';
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
  const [bankConnected, setBankConnected] = useState(!!data.plaidPublicToken);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const trpc = useTRPC();

  const createLinkToken = useMutation(trpc.plaid.createLinkToken.mutationOptions());

  const linkToken = createLinkToken.data?.linkToken ?? null;

  function handleGetLinkToken() {
    setConnectionError(null);
    createLinkToken.mutate();
  }

  function handlePlaidSuccess(publicToken: string) {
    updateData({ plaidPublicToken: publicToken, paymentMethod: 'bank_account' });
    setBankConnected(true);
    setConnectionError(null);
  }

  function handlePlaidExit() {
    if (!bankConnected) {
      setConnectionError('Bank connection was cancelled. You can try again or use a debit card.');
    }
  }

  function handleDebitCardChoice() {
    updateData({ paymentMethod: 'debit_card', plaidPublicToken: null });
    setBankConnected(false);
    setConnectionError(null);
  }

  function handleContinue() {
    if (bankConnected || data.paymentMethod === 'debit_card') {
      onNext();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Payment Method</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how you would like to make your payments. Bank account is used for biweekly
          installments. Your deposit will be charged via debit card at checkout.
        </p>
      </div>

      {/* Option 1: Bank account via Plaid */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Option 1: Bank Account (Recommended)</h3>
        <p className="text-xs text-muted-foreground">
          Recommended for biweekly installments. We verify your balance to ensure the plan works for
          you.
        </p>

        {!linkToken && !bankConnected && (
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleGetLinkToken}
            disabled={createLinkToken.isPending}
          >
            {createLinkToken.isPending ? 'Preparing...' : 'Connect Bank Account'}
          </Button>
        )}

        {linkToken && !bankConnected && (
          <PlaidLinkButton
            linkToken={linkToken}
            onSuccess={handlePlaidSuccess}
            onExit={handlePlaidExit}
          />
        )}

        {bankConnected && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Bank account connected</AlertTitle>
            <AlertDescription>
              Your bank account has been securely linked. We will use it for biweekly installment
              payments.
            </AlertDescription>
          </Alert>
        )}

        {connectionError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{connectionError}</AlertDescription>
          </Alert>
        )}

        {createLinkToken.isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to initialize bank connection. Please try again or use a debit card instead.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      {/* Option 2: Debit card */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Option 2: Debit Card</h3>
        <p className="text-xs text-muted-foreground">
          Pay all installments with your debit card. Your card will be charged at Stripe checkout.
        </p>
        <Button
          variant={data.paymentMethod === 'debit_card' && !bankConnected ? 'default' : 'outline'}
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
        <Button
          onClick={handleContinue}
          disabled={!bankConnected && data.paymentMethod !== 'debit_card'}
          size="lg"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
