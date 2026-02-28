'use client';

import { useQuery } from '@tanstack/react-query';
import { TrendingUp } from 'lucide-react';
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

export function EnrollmentTrends() {
  const trpc = useTRPC();
  const { data, isLoading, error } = useQuery(
    trpc.clinic.getEnrollmentTrends.queryOptions({ months: 12 }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enrollment Trends</CardTitle>
        <CardDescription>Monthly enrollment counts over the last 12 months.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Chart placeholder */}
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
          <TrendingUp className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Chart coming soon</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Unable to load enrollment trends.
          </p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No enrollment data available.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Enrollments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.month}>
                  <TableCell className="font-medium">{row.month}</TableCell>
                  <TableCell className="text-right">{row.enrollments}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
