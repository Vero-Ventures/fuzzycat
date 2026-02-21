'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, DollarSign, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTRPC } from '@/lib/trpc/client';
import { formatCents } from '@/lib/utils/money';

export function PayoutEarnings() {
  const trpc = useTRPC();

  const { data: earnings, isLoading, error } = useQuery(trpc.payout.earnings.queryOptions());

  if (isLoading) {
    return <PayoutEarningsSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Unable to load earnings data.</p>
        </CardContent>
      </Card>
    );
  }

  if (!earnings) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Payouts Received */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Received</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCents(earnings.totalPayoutCents)}</div>
          <p className="text-xs text-muted-foreground mt-1">From all completed payouts</p>
        </CardContent>
      </Card>

      {/* 3% Revenue Share */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">3% Revenue Share</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCents(earnings.totalClinicShareCents)}</div>
          <p className="text-xs text-muted-foreground mt-1">Platform administration share</p>
        </CardContent>
      </Card>

      {/* Pending Payouts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCents(earnings.pendingPayoutCents)}</div>
          <p className="text-xs text-muted-foreground mt-1">Awaiting transfer</p>
        </CardContent>
      </Card>

      {/* Completed Payouts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed Payouts</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{earnings.completedPayoutCount}</div>
          <p className="text-xs text-muted-foreground mt-1">Successfully transferred</p>
        </CardContent>
      </Card>
    </div>
  );
}

function PayoutEarningsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
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
