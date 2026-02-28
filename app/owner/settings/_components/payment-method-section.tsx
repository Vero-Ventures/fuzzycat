'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, CreditCard, Landmark, Loader2 } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTRPC } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import { PlaidLinkButton } from '../../enroll/_components/plaid-link-button';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function BusyIndicator({
  setupCard,
  exchangeToken,
}: {
  setupCard: boolean;
  exchangeToken: boolean;
}) {
  return (
    <p className="flex items-center gap-1 text-sm text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {setupCard
        ? 'Redirecting to card setup...'
        : exchangeToken
          ? 'Connecting bank account...'
          : 'Saving...'}
    </p>
  );
}

function SavedMethodDetails({
  isLoading,
  card,
  bankAccount,
}: {
  isLoading: boolean;
  card: { brand: string; last4: string } | null | undefined;
  bankAccount: { bankName: string; last4: string } | null | undefined;
}) {
  if (isLoading) return <Skeleton className="h-5 w-48" />;

  if (card || bankAccount) {
    return (
      <div className="text-sm text-muted-foreground">
        {card && (
          <p>
            {card.brand.charAt(0).toUpperCase() + card.brand.slice(1)} ending in {card.last4}
          </p>
        )}
        {bankAccount && (
          <p>
            {bankAccount.bankName} ****{bankAccount.last4}
          </p>
        )}
      </div>
    );
  }

  return <p className="text-sm text-muted-foreground">No payment method on file</p>;
}

function StatusMessage({
  saveStatus,
  errorMessage,
}: {
  saveStatus: SaveStatus;
  errorMessage: string | null;
}) {
  if (saveStatus === 'saved') {
    return (
      <p className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Payment method updated.
      </p>
    );
  }
  if (saveStatus === 'error' && errorMessage) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{errorMessage}</AlertDescription>
      </Alert>
    );
  }
  if (saveStatus === 'error') {
    return (
      <p className="text-sm text-destructive">Failed to update payment method. Please try again.</p>
    );
  }
  return null;
}

export function PaymentMethodSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { data: profile, isLoading } = useQuery(trpc.owner.getProfile.queryOptions());
  const { data: paymentDetails, isLoading: isLoadingDetails } = useQuery(
    trpc.owner.getPaymentMethodDetails.queryOptions(),
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPlaidLink, setShowPlaidLink] = useState(false);

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: trpc.owner.getProfile.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.owner.getPaymentMethodDetails.queryKey() });
  };

  const handleMutationError = (error: { message?: string }, fallback: string) => {
    setErrorMessage(error.message || fallback);
    setSaveStatus('error');
    setTimeout(() => setSaveStatus('idle'), 3000);
  };

  const setupCard = useMutation(
    trpc.owner.setupCardPaymentMethod.mutationOptions({
      onSuccess: (data) => {
        if (data.sessionUrl) window.location.href = data.sessionUrl;
      },
      onError: (error) => handleMutationError(error, 'Failed to start card setup.'),
    }),
  );

  const confirmCard = useMutation(
    trpc.owner.confirmCardPaymentMethod.mutationOptions({
      onSuccess: () => {
        setSaveStatus('saved');
        invalidateQueries();
        setTimeout(() => setSaveStatus('idle'), 2000);
      },
      onError: (error) => handleMutationError(error, 'Failed to confirm card setup.'),
    }),
  );

  const setupSessionId = searchParams.get('setup_session');
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally run only when setupSessionId changes to avoid re-triggering on mutation state changes
  useEffect(() => {
    if (setupSessionId && !confirmCard.isPending && !confirmCard.isSuccess) {
      confirmCard.mutate({ sessionId: setupSessionId });
    }
  }, [setupSessionId]);

  const createLinkToken = useMutation(trpc.plaid.createLinkToken.mutationOptions());

  const updateMutation = useMutation(
    trpc.owner.updatePaymentMethod.mutationOptions({
      onSuccess: () => {
        setSaveStatus('saved');
        invalidateQueries();
        setTimeout(() => setSaveStatus('idle'), 2000);
      },
      onError: (error) => handleMutationError(error, 'Failed to update payment method.'),
    }),
  );

  const exchangeToken = useMutation(
    trpc.plaid.exchangePublicToken.mutationOptions({
      onSuccess: () => {
        updateMutation.mutate({ paymentMethod: 'bank_account' });
        setShowPlaidLink(false);
      },
      onError: (error) => {
        handleMutationError(error, 'Failed to connect bank account.');
        setShowPlaidLink(false);
      },
    }),
  );

  function handleSelectDebitCard() {
    if (profile?.paymentMethod === 'debit_card') return;
    setErrorMessage(null);
    setSaveStatus('saving');
    if (!paymentDetails?.card) {
      const baseUrl = `${window.location.origin}${pathname}`;
      setupCard.mutate({ successUrl: baseUrl, cancelUrl: baseUrl });
    } else {
      updateMutation.mutate({ paymentMethod: 'debit_card' });
    }
  }

  function handleSelectBankAccount() {
    if (profile?.paymentMethod === 'bank_account') return;
    setErrorMessage(null);
    if (!paymentDetails?.bankAccount) {
      setShowPlaidLink(true);
      createLinkToken.mutate();
    } else {
      setSaveStatus('saving');
      updateMutation.mutate({ paymentMethod: 'bank_account' });
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const currentMethod = profile?.paymentMethod;
  const isBusy =
    saveStatus === 'saving' ||
    setupCard.isPending ||
    confirmCard.isPending ||
    exchangeToken.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Method</CardTitle>
        <CardDescription>Choose how your installment payments are collected.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <MethodOption
            label="Debit Card"
            description="Installments are charged to your debit card."
            icon={<CreditCard className="h-5 w-5" />}
            selected={currentMethod === 'debit_card'}
            disabled={isBusy}
            onSelect={handleSelectDebitCard}
          />
          <MethodOption
            label="Bank Account (ACH)"
            description="Installments are debited from your bank account."
            icon={<Landmark className="h-5 w-5" />}
            selected={currentMethod === 'bank_account'}
            disabled={isBusy}
            onSelect={handleSelectBankAccount}
          />
        </div>

        {showPlaidLink && createLinkToken.data?.linkToken && (
          <PlaidLinkButton
            linkToken={createLinkToken.data.linkToken}
            onSuccess={(publicToken, accountId) => {
              setSaveStatus('saving');
              exchangeToken.mutate({ publicToken, accountId });
            }}
            onExit={() => setShowPlaidLink(false)}
            disabled={exchangeToken.isPending}
          />
        )}

        <SavedMethodDetails
          isLoading={isLoadingDetails}
          card={paymentDetails?.card}
          bankAccount={paymentDetails?.bankAccount}
        />

        {isBusy && (
          <BusyIndicator setupCard={setupCard.isPending} exchangeToken={exchangeToken.isPending} />
        )}
        <StatusMessage saveStatus={saveStatus} errorMessage={errorMessage} />
      </CardContent>
    </Card>
  );
}

function MethodOption({
  label,
  description,
  icon,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      className={cn(
        'flex h-auto items-start gap-3 p-4 text-left',
        selected && 'border-primary bg-primary/5',
      )}
      onClick={onSelect}
    >
      <span className={cn('mt-0.5', selected ? 'text-primary' : 'text-muted-foreground')}>
        {icon}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs font-normal text-muted-foreground">{description}</span>
      </span>
    </Button>
  );
}
