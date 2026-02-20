'use client';

import { useQuery } from '@tanstack/react-query';
import { CreditCard, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTRPC } from '@/lib/trpc/client';

export function PaymentMethodSection() {
  const trpc = useTRPC();
  const { data: profile, isLoading } = useQuery(trpc.owner.getProfile.queryOptions());

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

  const method = profile?.paymentMethod;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Method</CardTitle>
        <CardDescription>Your current payment method for installment payments.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 rounded-md border p-4">
          {method === 'bank_account' ? (
            <Landmark className="h-5 w-5 text-muted-foreground" />
          ) : (
            <CreditCard className="h-5 w-5 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium">
              {method === 'bank_account' ? 'Bank Account (ACH)' : 'Debit Card'}
            </p>
            <p className="text-xs text-muted-foreground">
              {method === 'bank_account'
                ? 'Installments are debited from your connected bank account.'
                : 'Installments are charged to your debit card on file.'}
            </p>
          </div>
        </div>
        <Button variant="outline" disabled>
          Update Payment Method
        </Button>
        <p className="text-xs text-muted-foreground">
          To update your payment method, please contact your veterinary clinic.
        </p>
      </CardContent>
    </Card>
  );
}
