'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { AvatarInitials } from '@/components/shared/avatar-initials';
import { StatusBadge } from '@/components/shared/status-badge';
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

export default function ClinicPlanDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; planId: string }>;
}) {
  const { clientId, planId } = use(params);
  const trpc = useTRPC();

  const { data, isLoading, error } = useQuery(
    trpc.clinic.getClientPlanDetails.queryOptions({ planId }),
  );

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

  if (error || !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">Unable to load plan details.</p>
      </div>
    );
  }

  const { plan, payments, payouts } = data;
  const ownerName = plan.ownerName ?? 'Unknown';
  const succeededPayments = payments.filter((p) => p.status === 'succeeded');
  const totalExpected = 1 + plan.numInstallments;
  const progressPercent =
    totalExpected > 0 ? Math.round((succeededPayments.length / totalExpected) * 100) : 0;
  const totalPaidCents = succeededPayments.reduce((sum, p) => sum + p.amountCents, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/clinic/clients" className="hover:text-foreground">
          Clients
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/clinic/clients/${clientId}`} className="hover:text-foreground">
          {ownerName}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Payment Plan Details</span>
      </nav>

      {/* Two-column info cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Client & Pet Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client &amp; Pet Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <AvatarInitials name={ownerName} size="md" />
              <div>
                <p className="font-semibold">{ownerName}</p>
                <p className="text-sm text-muted-foreground">{plan.ownerEmail ?? ''}</p>
                <p className="text-sm text-muted-foreground">{plan.ownerPhone ?? ''}</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-muted/50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pet
              </p>
              <p className="font-medium">{plan.petName ?? 'Unknown Pet'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Payment Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Vet Bill</p>
                <p className="font-medium">{formatCents(plan.totalBillCents)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total with Fee</p>
                <p className="font-medium">{formatCents(plan.totalWithFeeCents)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Deposit</p>
                <p className="font-medium">{formatCents(plan.depositCents)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Biweekly Payment</p>
                <p className="font-medium">
                  {formatCents(plan.installmentCents)} x {plan.numInstallments}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {succeededPayments.length} of {totalExpected} payments
                </span>
                <span className="font-medium">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Paid: {formatCents(totalPaidCents)}</span>
                <span>
                  Remaining: {formatCents(Math.max(0, plan.totalWithFeeCents - totalPaidCents))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Installment schedule table */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Installment Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Processed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
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
                    {formatDate(payment.scheduledAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(payment.processedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <p className="mt-4 text-sm text-muted-foreground">
            Biweekly payments of {formatCents(plan.installmentCents)}
          </p>
        </CardContent>
      </Card>

      {/* Payouts */}
      {payouts.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>3% Share</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell>{formatCents(payout.amountCents)}</TableCell>
                    <TableCell className="font-medium text-primary">
                      {formatCents(payout.clinicShareCents)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={payout.status} size="sm" />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(payout.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
