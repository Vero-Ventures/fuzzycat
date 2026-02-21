'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

/** Format a YYYY-MM string to a readable month label (e.g. "Feb 2026"). */
function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function RevenueTable() {
  const trpc = useTRPC();
  const { data, isLoading, error } = useQuery(trpc.clinic.getMonthlyRevenue.queryOptions());

  if (isLoading) {
    return <RevenueTableSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Unable to load revenue data.</p>
        </CardContent>
      </Card>
    );
  }

  const months = data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Revenue</CardTitle>
        <CardDescription>
          Payout totals and your 3% platform administration share by month.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {months.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No payout data yet. Revenue will appear here after your first successful payout.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Payouts</TableHead>
                <TableHead className="text-right">Total Received</TableHead>
                <TableHead className="text-right">3% Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((row) => (
                <TableRow key={row.month}>
                  <TableCell className="font-medium">{formatMonth(row.month)}</TableCell>
                  <TableCell className="text-right">{row.payoutCount}</TableCell>
                  <TableCell className="text-right">{formatCents(row.totalPayoutCents)}</TableCell>
                  <TableCell className="text-right font-medium text-primary">
                    {formatCents(row.totalShareCents)}
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

function RevenueTableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
