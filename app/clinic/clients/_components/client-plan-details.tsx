'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
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

const PAYMENT_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> =
  {
    succeeded: 'default',
    pending: 'secondary',
    processing: 'secondary',
    failed: 'destructive',
    retried: 'destructive',
    written_off: 'destructive',
  };

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  succeeded: 'Succeeded',
  pending: 'Pending',
  processing: 'Processing',
  failed: 'Failed',
  retried: 'Retried',
  written_off: 'Written Off',
};

interface ClientPlanDetailsProps {
  planId: string;
}

export function ClientPlanDetails({ planId }: ClientPlanDetailsProps) {
  const trpc = useTRPC();
  const { data, isLoading, error } = useQuery(
    trpc.clinic.getClientPlanDetails.queryOptions({ planId }),
  );

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">Unable to load plan details.</p>
      </div>
    );
  }

  const { plan, payments, payouts } = data;

  const succeededPayments = payments.filter((p) => p.status === 'succeeded');
  const totalExpected = 1 + plan.numInstallments;
  const progressPercent =
    totalExpected > 0 ? Math.round((succeededPayments.length / totalExpected) * 100) : 0;
  const totalPaidCents = succeededPayments.reduce((sum, p) => sum + p.amountCents, 0);

  return (
    <div className="p-4 space-y-4">
      {/* Owner info header */}
      <div className="flex flex-wrap gap-6 text-sm">
        <div>
          <span className="text-muted-foreground">Owner: </span>
          <span className="font-medium">{plan.ownerName ?? 'Unknown'}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Email: </span>
          <span>{plan.ownerEmail ?? '--'}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Phone: </span>
          <span>{plan.ownerPhone ?? '--'}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Pet: </span>
          <span>{plan.petName ?? '--'}</span>
        </div>
      </div>

      {/* Plan financial summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
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
          <p className="text-muted-foreground">Installment</p>
          <p className="font-medium">
            {formatCents(plan.installmentCents)} x {plan.numInstallments}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {succeededPayments.length} of {totalExpected} payments complete
          </span>
          <span className="font-medium">{progressPercent}%</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Paid: {formatCents(totalPaidCents)}</span>
          <span>Remaining: {formatCents(plan.totalWithFeeCents - totalPaidCents)}</span>
        </div>
      </div>

      <Separator />

      {/* Payments table */}
      <div>
        <h4 className="text-sm font-medium mb-2">Payment Schedule</h4>
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
                  <Badge
                    variant={PAYMENT_STATUS_VARIANT[payment.status] ?? 'secondary'}
                    className="text-xs"
                  >
                    {PAYMENT_STATUS_LABEL[payment.status] ?? payment.status}
                  </Badge>
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
      </div>

      {/* Payouts table */}
      {payouts.length > 0 && (
        <div>
          <Separator className="mb-4" />
          <h4 className="text-sm font-medium mb-2">Payouts for this Plan</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Amount</TableHead>
                <TableHead>3% Share</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Transfer ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((payout) => (
                <TableRow key={payout.id}>
                  <TableCell>{formatCents(payout.amountCents)}</TableCell>
                  <TableCell className="text-primary font-medium">
                    {formatCents(payout.clinicShareCents)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        payout.status === 'succeeded'
                          ? 'default'
                          : payout.status === 'failed'
                            ? 'destructive'
                            : 'secondary'
                      }
                      className="text-xs"
                    >
                      {payout.status === 'succeeded'
                        ? 'Succeeded'
                        : payout.status === 'failed'
                          ? 'Failed'
                          : 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(payout.createdAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {payout.stripeTransferId ?? '--'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
