'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export function RevenueReport() {
  const trpc = useTRPC();

  // Default date range: last 12 months
  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const [dateFrom, setDateFrom] = useState(twelveMonthsAgo.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(now.toISOString().slice(0, 10));

  const fromISO = new Date(`${dateFrom}T00:00:00.000Z`).toISOString();
  const toISO = new Date(`${dateTo}T23:59:59.999Z`).toISOString();

  const { data, isLoading, error } = useQuery(
    trpc.clinic.getRevenueReport.queryOptions({
      dateFrom: fromISO,
      dateTo: toISO,
    }),
  );

  // Calculate totals
  const totals = data?.reduce(
    (acc, row) => ({
      enrollments: acc.enrollments + row.enrollments,
      revenueCents: acc.revenueCents + row.revenueCents,
      payoutsCents: acc.payoutsCents + row.payoutsCents,
      clinicShareCents: acc.clinicShareCents + row.clinicShareCents,
    }),
    { enrollments: 0, revenueCents: 0, payoutsCents: 0, clinicShareCents: 0 },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Report</CardTitle>
        <CardDescription>Monthly revenue breakdown within a date range.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date range picker */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <Label htmlFor="date-from">From</Label>
            <Input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="date-to">To</Label>
            <Input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-40"
            />
          </div>
        </div>

        {/* Chart placeholder */}
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
          <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Chart coming soon</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Unable to load revenue report.
          </p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No revenue data for the selected period.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Enrollments</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Payouts</TableHead>
                <TableHead className="text-right">Clinic Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.month}>
                  <TableCell className="font-medium">{row.month}</TableCell>
                  <TableCell className="text-right">{row.enrollments}</TableCell>
                  <TableCell className="text-right">{formatCents(row.revenueCents)}</TableCell>
                  <TableCell className="text-right">{formatCents(row.payoutsCents)}</TableCell>
                  <TableCell className="text-right">{formatCents(row.clinicShareCents)}</TableCell>
                </TableRow>
              ))}
              {/* Totals row */}
              {totals && (
                <TableRow className="font-bold border-t-2">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{totals.enrollments}</TableCell>
                  <TableCell className="text-right">{formatCents(totals.revenueCents)}</TableCell>
                  <TableCell className="text-right">{formatCents(totals.payoutsCents)}</TableCell>
                  <TableCell className="text-right">
                    {formatCents(totals.clinicShareCents)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
