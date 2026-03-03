'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, CreditCard, Landmark, Loader2 } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTRPC } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function BusyIndicator({ setupCard }: { setupCard: boolean }) {
  return (
    <p className="flex items-center gap-1 text-sm text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {setupCard ? 'Redirecting to card setup...' : 'Saving...'}
    </p>
  );
}

function SavedMethodDetails({
  isLoading,
  card,
  bankAccount,
  disabled,
  onReplaceCard,
  onRemoveCard,
  onRemoveBank,
}: {
  isLoading: boolean;
  card: { brand: string; last4: string } | null | undefined;
  bankAccount: { bankName: string; last4: string } | null | undefined;
  disabled: boolean;
  onReplaceCard: () => void;
  onRemoveCard: () => void;
  onRemoveBank: () => void;
}) {
  if (isLoading) return <Skeleton className="h-5 w-48" />;

  if (card || bankAccount) {
    return (
      <div className="space-y-2 text-sm text-muted-foreground">
        {card && (
          <div className="flex items-center justify-between">
            <p>
              {card.brand.charAt(0).toUpperCase() + card.brand.slice(1)} ending in {card.last4}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={disabled} onClick={onReplaceCard}>
                Replace
              </Button>
              <RemoveConfirmDialog
                methodLabel="debit card"
                disabled={disabled}
                onConfirm={onRemoveCard}
              />
            </div>
          </div>
        )}
        {bankAccount && (
          <div className="flex items-center justify-between">
            <p>
              {bankAccount.bankName} ****{bankAccount.last4}
            </p>
            <div className="flex gap-2">
              <RemoveConfirmDialog
                methodLabel="bank account"
                disabled={disabled}
                onConfirm={onRemoveBank}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return <p className="text-sm text-muted-foreground">No payment method on file</p>;
}

function RemoveConfirmDialog({
  methodLabel,
  disabled,
  onConfirm,
}: {
  methodLabel: string;
  disabled: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="text-destructive hover:text-destructive"
        >
          Remove
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove payment method?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove your {methodLabel}. You cannot undo this action.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
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
  const { data: paymentDetails, isLoading: isLoadingDetails } = useQuery({
    ...trpc.owner.getPaymentMethodDetails.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const removeMutation = useMutation(
    trpc.owner.removePaymentMethod.mutationOptions({
      onSuccess: () => {
        setSaveStatus('saved');
        invalidateQueries();
        setTimeout(() => setSaveStatus('idle'), 2000);
      },
      onError: (error) => handleMutationError(error, 'Failed to remove payment method.'),
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

  async function runFinancialConnections(clientSecret: string, setupIntentId: string) {
    const { loadStripe } = await import('@stripe/stripe-js');
    const stripeJs = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '');
    if (!stripeJs) {
      handleMutationError(
        { message: 'Stripe failed to load' },
        'Failed to load payment processor.',
      );
      return;
    }
    const { error: stripeError } = await stripeJs.collectBankAccountForSetup({
      clientSecret,
      params: {
        payment_method_type: 'us_bank_account',
        payment_method_data: {
          billing_details: {
            name: profile?.name ?? '',
            email: profile?.email ?? '',
          },
        },
      },
    });
    if (stripeError) {
      if (stripeError.type !== 'validation_error') {
        handleMutationError({ message: stripeError.message }, 'Bank account connection failed.');
      }
      setSaveStatus('idle');
      return;
    }
    const { error: confirmError, setupIntent } =
      await stripeJs.confirmUsBankAccountSetup(clientSecret);
    if (confirmError) {
      handleMutationError({ message: confirmError.message }, 'Bank account confirmation failed.');
      return;
    }
    if (setupIntent?.status === 'succeeded') {
      confirmBank.mutate({ setupIntentId });
    } else {
      setSaveStatus('idle');
    }
  }

  const createBankSetup = useMutation(
    trpc.owner.createBankAccountSetupIntent.mutationOptions({
      onSuccess: (data) => {
        if (!data.clientSecret || !data.setupIntentId) {
          handleMutationError(
            { message: 'No client secret returned' },
            'Failed to start bank setup.',
          );
          return;
        }
        runFinancialConnections(data.clientSecret, data.setupIntentId);
      },
      onError: (error) => handleMutationError(error, 'Failed to start bank setup.'),
    }),
  );

  const confirmBank = useMutation(
    trpc.owner.confirmBankAccount.mutationOptions({
      onSuccess: () => {
        setSaveStatus('saved');
        invalidateQueries();
        setTimeout(() => setSaveStatus('idle'), 2000);
      },
      onError: (error) => handleMutationError(error, 'Failed to confirm bank account.'),
    }),
  );

  function handleSelectBankAccount() {
    if (profile?.paymentMethod === 'bank_account') return;
    setErrorMessage(null);
    if (!paymentDetails?.bankAccount) {
      setSaveStatus('saving');
      createBankSetup.mutate();
    } else {
      setSaveStatus('saving');
      updateMutation.mutate({ paymentMethod: 'bank_account' });
    }
  }

  function handleReplaceCard() {
    setErrorMessage(null);
    setSaveStatus('saving');
    const baseUrl = `${window.location.origin}${pathname}`;
    setupCard.mutate({ successUrl: baseUrl, cancelUrl: baseUrl });
  }

  function handleRemoveCard() {
    setErrorMessage(null);
    setSaveStatus('saving');
    removeMutation.mutate({ method: 'debit_card' });
  }

  function handleRemoveBank() {
    setErrorMessage(null);
    setSaveStatus('saving');
    removeMutation.mutate({ method: 'bank_account' });
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
    createBankSetup.isPending ||
    confirmBank.isPending ||
    removeMutation.isPending;

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

        <SavedMethodDetails
          isLoading={isLoadingDetails}
          card={paymentDetails?.card}
          bankAccount={paymentDetails?.bankAccount}
          disabled={isBusy}
          onReplaceCard={handleReplaceCard}
          onRemoveCard={handleRemoveCard}
          onRemoveBank={handleRemoveBank}
        />

        {isBusy && <BusyIndicator setupCard={setupCard.isPending || createBankSetup.isPending} />}
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
