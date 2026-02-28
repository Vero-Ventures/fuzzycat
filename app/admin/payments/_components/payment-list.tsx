'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTRPC } from '@/lib/trpc/client';
import { formatDate } from '@/lib/utils/date';
import { formatCents } from '@/lib/utils/money';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  succeeded: 'default',
  pending: 'secondary',
  processing: 'secondary',
  failed: 'destructive',
  retried: 'outline',
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

type PaymentStatusFilter =
  | 'all'
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'retried'
  | 'written_off';

export function PaymentList() {
  const trpc = useTRPC();
  const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const { data, isLoading, error } = useQuery(
    trpc.admin.getPayments.queryOptions({
      status: statusFilter === 'all' ? undefined : statusFilter,
      dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`).toISOString() : undefined,
      dateTo: dateTo ? new Date(`${dateTo}T23:59:59.999Z`).toISOString() : undefined,
      limit,
      offset,
    }),
  );

  function handleStatusChange(filter: string) {
    setStatusFilter(filter as PaymentStatusFilter);
    setOffset(0);
  }

  const totalCount = data?.pagination.totalCount ?? 0;
  const hasNextPage = offset + limit < totalCount;
  const hasPrevPage = offset > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payments</CardTitle>
        <CardDescription>Monitor all payments across the platform.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={statusFilter} onValueChange={handleStatusChange}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="succeeded">Succeeded</TabsTrigger>
              <TabsTrigger value="failed">Failed</TabsTrigger>
              <TabsTrigger value="written_off">Written Off</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setOffset(0);
              }}
              className="w-40"
              placeholder="From"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setOffset(0);
              }}
              className="w-40"
              placeholder="To"
            />
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <PaymentListSkeleton />
        ) : error ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Unable to load payments.</p>
        ) : !data || data.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No payments found matching your filters.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Clinic</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDate(payment.scheduledAt)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{payment.ownerName ?? 'Unknown'}</span>
                        {payment.ownerEmail && (
                          <p className="text-xs text-muted-foreground">{payment.ownerEmail}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{payment.clinicName ?? 'Unknown'}</TableCell>
                    <TableCell>{formatCents(payment.amountCents)}</TableCell>
                    <TableCell className="capitalize">{payment.type}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[payment.status] ?? 'secondary'}>
                        {STATUS_LABEL[payment.status] ?? payment.status}
                      </Badge>
                      {payment.failureReason && (
                        <p className="text-xs text-destructive mt-1">{payment.failureReason}</p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Showing {offset + 1}--{Math.min(offset + limit, totalCount)} of {totalCount}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={!hasPrevPage}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOffset(offset + limit)}
                  disabled={!hasNextPage}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
