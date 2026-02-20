'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CreditCard, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTRPC } from '@/lib/trpc/client';
import { formatCents } from '@/lib/utils/money';

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

function daysUntil(date: Date | string): number {
  const target = new Date(date);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function formatCountdown(daysLeft: number): string {
  if (daysLeft < 0) return 'Overdue';
  if (daysLeft === 0) return 'Today';
  if (daysLeft === 1) return 'Tomorrow';
  return `in ${daysLeft} days`;
}

interface NextPaymentData {
  amountCents: number;
  scheduledAt: Date | string;
  type: string;
  sequenceNum: number | null;
}

function NextPaymentCard({ payment }: { payment: NextPaymentData | null }) {
  const daysLeft = payment ? daysUntil(payment.scheduledAt) : null;

  return (
    <Card className="md:col-span-1 border-primary/20 bg-primary/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Next Payment</CardTitle>
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {payment ? (
          <>
            <div className="text-2xl font-bold">{formatCents(payment.amountCents)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDate(payment.scheduledAt)}
              {daysLeft !== null && (
                <span className={daysLeft < 0 ? 'ml-1 text-destructive' : 'ml-1'}>
                  ({formatCountdown(daysLeft)})
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1 capitalize">
              {payment.type}
              {payment.sequenceNum !== null && payment.type === 'installment'
                ? ` ${payment.sequenceNum} of 6`
                : ''}
            </p>
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground mt-1">No upcoming payments</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardSummary() {
  const trpc = useTRPC();
  const { data, isLoading, error } = useQuery(trpc.owner.getDashboardSummary.queryOptions());

  if (isLoading) {
    return <DashboardSummarySkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Unable to load dashboard summary.</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <NextPaymentCard payment={data.nextPayment} />

      {/* Total Paid */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCents(data.totalPaidCents)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            across {data.totalPlans} plan{data.totalPlans !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>

      {/* Total Remaining */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Remaining</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCents(data.totalRemainingCents)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {data.activePlans} active plan{data.activePlans !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardSummarySkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
