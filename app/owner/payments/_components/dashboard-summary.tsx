'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CreditCard, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useTRPC } from '@/lib/trpc/client';
import { daysUntil, formatCountdown, formatDate } from '@/lib/utils/date';
import { formatCents } from '@/lib/utils/money';

interface NextPaymentData {
  amountCents: number;
  scheduledAt: Date | string;
  type: string;
  sequenceNum: number | null;
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

  const totalAmount = data.totalPaidCents + data.totalRemainingCents;
  const progressPercent =
    totalAmount > 0 ? Math.round((data.totalPaidCents / totalAmount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Hi there! Your pets are in good hands.
        </h1>
        <p className="mt-1 text-muted-foreground">
          Track your payment progress and upcoming installments.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Active Plan Summary */}
        <Card className="border-primary/20 bg-primary/5 md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Payment</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <NextPaymentContent payment={data.nextPayment} />
            {data.activePlans > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="mt-1 h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Total Paid */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCents(data.totalPaidCents)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
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
            <p className="mt-1 text-xs text-muted-foreground">
              {data.activePlans} active plan{data.activePlans !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NextPaymentContent({ payment }: { payment: NextPaymentData | null }) {
  if (!payment) {
    return (
      <>
        <div className="text-2xl font-bold">--</div>
        <p className="mt-1 text-xs text-muted-foreground">No upcoming payments</p>
      </>
    );
  }

  const daysLeft = daysUntil(payment.scheduledAt);

  return (
    <>
      <div className="text-2xl font-bold">{formatCents(payment.amountCents)}</div>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatDate(payment.scheduledAt)}
        {daysLeft !== null && (
          <span className={daysLeft < 0 ? 'ml-1 text-destructive' : 'ml-1'}>
            ({formatCountdown(payment.scheduledAt)})
          </span>
        )}
      </p>
      <p className="mt-1 text-xs capitalize text-muted-foreground">
        {payment.type}
        {payment.sequenceNum !== null && payment.type === 'installment'
          ? ` ${payment.sequenceNum} of 6`
          : ''}
      </p>
    </>
  );
}

function DashboardSummarySkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="mb-2 h-8 w-32" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
