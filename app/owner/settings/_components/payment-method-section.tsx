'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CreditCard, Landmark } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTRPC } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

type PaymentMethod = 'debit_card' | 'bank_account';

export function PaymentMethodSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery(trpc.owner.getProfile.queryOptions());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const updateMutation = useMutation(
    trpc.owner.updatePaymentMethod.mutationOptions({
      onSuccess: () => {
        setSaveStatus('saved');
        queryClient.invalidateQueries({ queryKey: trpc.owner.getProfile.queryKey() });
        setTimeout(() => setSaveStatus('idle'), 2000);
      },
      onError: () => {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      },
    }),
  );

  function handleSelect(method: PaymentMethod) {
    if (method === profile?.paymentMethod) return;
    setSaveStatus('saving');
    updateMutation.mutate({ paymentMethod: method });
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Method</CardTitle>
        <CardDescription>Choose how your installment payments are collected.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <MethodOption
            method="debit_card"
            label="Debit Card"
            description="Installments are charged to your debit card."
            icon={<CreditCard className="h-5 w-5" />}
            selected={currentMethod === 'debit_card'}
            disabled={saveStatus === 'saving'}
            onSelect={handleSelect}
          />
          <MethodOption
            method="bank_account"
            label="Bank Account (ACH)"
            description="Installments are debited from your bank account."
            icon={<Landmark className="h-5 w-5" />}
            selected={currentMethod === 'bank_account'}
            disabled={saveStatus === 'saving'}
            onSelect={handleSelect}
          />
        </div>
        {saveStatus === 'saved' && (
          <p className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Payment method updated.
          </p>
        )}
        {saveStatus === 'error' && (
          <p className="text-sm text-destructive">
            Failed to update payment method. Please try again.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MethodOption({
  method,
  label,
  description,
  icon,
  selected,
  disabled,
  onSelect,
}: {
  method: PaymentMethod;
  label: string;
  description: string;
  icon: React.ReactNode;
  selected: boolean;
  disabled: boolean;
  onSelect: (method: PaymentMethod) => void;
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
      onClick={() => onSelect(method)}
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
