'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTRPC } from '@/lib/trpc/client';
import { formatCents } from '@/lib/utils/money';

function formatDate(date: Date | string | null): string {
  if (!date) return '--';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  deposit_paid: 'secondary',
  completed: 'outline',
  pending: 'secondary',
  defaulted: 'destructive',
  cancelled: 'destructive',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  deposit_paid: 'Deposit Paid',
  completed: 'Completed',
  pending: 'Pending',
  defaulted: 'Defaulted',
  cancelled: 'Cancelled',
};

export function ActivePlansSection() {
  const trpc = useTRPC();
  const { data: plans, isLoading } = useQuery(trpc.owner.getPlans.queryOptions());

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Plans</CardTitle>
        <CardDescription>Your payment plan agreements.</CardDescription>
      </CardHeader>
      <CardContent>
        {!plans || plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payment plans found.</p>
        ) : (
          <div className="space-y-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between rounded-md border p-4"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">{plan.clinicName ?? 'Unknown Clinic'}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCents(plan.totalWithFeeCents)} total &middot; Started{' '}
                    {formatDate(plan.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={STATUS_VARIANT[plan.status] ?? 'secondary'}>
                    {STATUS_LABEL[plan.status] ?? plan.status}
                  </Badge>
                  <Link
                    href="/owner/payments"
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
