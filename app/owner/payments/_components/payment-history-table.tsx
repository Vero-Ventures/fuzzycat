'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { formatCents } from '@/lib/utils/money';

interface PaymentHistoryTableProps {
  planId: string;
}

function formatDate(date: Date | string | null): string {
  if (!date) return '--';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  succeeded: 'default',
  pending: 'secondary',
  processing: 'secondary',
  failed: 'destructive',
  retried: 'destructive',
  written_off: 'destructive',
};

const STATUS_LABEL: Record<string, string> = {
  succeeded: 'Succeeded',
  pending: 'Pending',
  processing: 'Processing',
  failed: 'Failed',
  retried: 'Retried',
  written_off: 'Written Off',
};

const PAGE_SIZE = 10;

export function PaymentHistoryTable({ planId }: PaymentHistoryTableProps) {
  const [page, setPage] = useState(1);
  const trpc = useTRPC();

  const { data, isLoading, error } = useQuery(
    trpc.owner.getPaymentHistory.queryOptions({
      planId,
      page,
      pageSize: PAGE_SIZE,
    }),
  );

  if (isLoading) {
    return <PaymentHistoryTableSkeleton />;
  }

  if (error) {
    return <p className="text-sm text-muted-foreground py-4">Unable to load payment history.</p>;
  }

  if (!data || data.payments.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No payments recorded yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="text-sm">
                  {formatDate(payment.processedAt ?? payment.scheduledAt)}
                </TableCell>
                <TableCell className="text-sm capitalize">
                  {payment.type}
                  {payment.sequenceNum !== null && payment.type === 'installment'
                    ? ` #${payment.sequenceNum}`
                    : ''}
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {formatCents(payment.amountCents)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={STATUS_VARIANT[payment.status] ?? 'secondary'}
                    className="text-xs"
                  >
                    {STATUS_LABEL[payment.status] ?? payment.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.pagination.totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentHistoryTableSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
