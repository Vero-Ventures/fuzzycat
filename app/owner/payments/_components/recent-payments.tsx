'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTRPC } from '@/lib/trpc/client';
import { formatDate } from '@/lib/utils/date';
import { formatCents } from '@/lib/utils/money';

export function RecentPayments() {
  const trpc = useTRPC();
  const { data: plans, isLoading: plansLoading } = useQuery(trpc.owner.getPlans.queryOptions());

  const activePlanIds = (plans ?? []).map((p) => p.id);

  const paymentQueries = useQueries({
    queries: activePlanIds.map((planId) =>
      trpc.owner.getPaymentHistory.queryOptions({ planId, page: 1, pageSize: 10 }),
    ),
  });

  const isLoading = plansLoading || paymentQueries.some((q) => q.isLoading);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">No payment history yet.</p>
        </CardContent>
      </Card>
    );
  }

  // Collect all payments from all queries, tagging with clinic name
  const allPayments = paymentQueries.flatMap((q, idx) => {
    const planData = plans[idx];
    return (q.data?.payments ?? []).map((payment) => ({
      ...payment,
      planClinicName: planData?.clinicName,
    }));
  });

  // Sort by date descending and take top 10
  const recentPayments = allPayments
    .sort((a, b) => {
      const dateA = new Date(a.scheduledAt).getTime();
      const dateB = new Date(b.scheduledAt).getTime();
      return dateB - dateA;
    })
    .slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Payments</CardTitle>
      </CardHeader>
      <CardContent>
        {recentPayments.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No payment history yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="text-muted-foreground">
                    {formatDate(payment.scheduledAt)}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium capitalize">{payment.type}</span>
                    {payment.planClinicName && (
                      <span className="text-muted-foreground">
                        {' '}
                        &middot; {payment.planClinicName}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCents(payment.amountCents)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={payment.status} size="sm" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
