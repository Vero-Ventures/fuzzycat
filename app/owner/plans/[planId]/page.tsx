'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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

export default function OwnerPlanDetailPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = use(params);
  const trpc = useTRPC();

  const {
    data: plan,
    isLoading,
    error,
  } = useQuery(trpc.owner.getPlanById.queryOptions({ planId }));

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-6 w-64" />
        <div className="mt-8 space-y-6">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">Unable to load plan details.</p>
      </div>
    );
  }

  const totalExpected = 1 + plan.numInstallments;
  const progressPercent =
    totalExpected > 0 ? Math.round((plan.succeededCount / totalExpected) * 100) : 0;
  const remainingCents = Math.max(0, plan.totalWithFeeCents - plan.totalPaidCents);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/owner/plans" className="hover:text-foreground">
          My Plans
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Plan Details</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: treatment card + installment schedule */}
        <div className="space-y-6 lg:col-span-2">
          {/* Treatment card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{plan.clinicName ?? 'Veterinary Care'}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Plan {plan.id.slice(0, 8)}</p>
                </div>
                <StatusBadge status={plan.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Vet Bill</p>
                  <p className="font-medium">{formatCents(plan.totalBillCents)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Platform Fee</p>
                  <p className="font-medium">{formatCents(plan.feeCents)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-bold">{formatCents(plan.totalWithFeeCents)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Remaining</p>
                  <p className="font-medium">{formatCents(remainingCents)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {plan.succeededCount} of {totalExpected} payments
                  </span>
                  <span className="font-medium">{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Installment schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Installment Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <OwnerPaymentSchedule planId={plan.id} />
              <p className="mt-4 text-sm text-muted-foreground">
                Biweekly payments of {formatCents(plan.installmentCents)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right column: account details */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan ID</span>
                <span className="font-mono text-xs">{plan.id.slice(0, 12)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Auto-Pay</span>
                <Badge variant="outline" className="text-xs">
                  Enabled
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Interest</span>
                <span className="font-medium text-primary">0% APR</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(plan.createdAt)}</span>
              </div>
              {plan.completedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed</span>
                  <span>{formatDate(plan.completedAt)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Service Provider</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{plan.clinicName ?? 'Unknown Clinic'}</p>
              <p className="mt-1 text-sm text-muted-foreground">Veterinary Clinic</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function OwnerPaymentSchedule({ planId }: { planId: string }) {
  const trpc = useTRPC();
  const { data, isLoading, error } = useQuery(
    trpc.owner.getPaymentHistory.queryOptions({ planId, page: 1, pageSize: 20 }),
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (error || !data || data.payments.length === 0) {
    return <p className="text-sm text-muted-foreground">No payments recorded yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell className="capitalize">
              {payment.type === 'installment' && payment.sequenceNum
                ? `Installment ${payment.sequenceNum}`
                : 'Deposit'}
            </TableCell>
            <TableCell>{formatCents(payment.amountCents)}</TableCell>
            <TableCell>
              <StatusBadge status={payment.status} size="sm" />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(payment.processedAt ?? payment.scheduledAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
