'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { formatDate } from '@/lib/utils/date';
import { formatCents } from '@/lib/utils/money';

const TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  contribution: 'default',
  claim: 'destructive',
  recovery: 'outline',
};

const TYPE_LABEL: Record<string, string> = {
  contribution: 'Contribution',
  claim: 'Claim',
  recovery: 'Recovery',
};

export function RiskPoolHistory() {
  const trpc = useTRPC();
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const { data, isLoading, error } = useQuery(
    trpc.admin.getRiskPoolDetails.queryOptions({ limit, offset }),
  );

  const totalCount = data?.pagination.totalCount ?? 0;
  const hasNextPage = offset + limit < totalCount;
  const hasPrevPage = offset > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform Reserve History</CardTitle>
        <CardDescription>Timeline of contributions to the platform reserve fund.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <RiskPoolHistorySkeleton />
        ) : error ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Unable to load reserve history.
          </p>
        ) : !data || data.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No reserve entries yet. Entries will appear as enrollments are created.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Plan ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDate(entry.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TYPE_VARIANT[entry.type] ?? 'secondary'}>
                        {TYPE_LABEL[entry.type] ?? entry.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {entry.type === 'claim' ? '-' : '+'}
                      {formatCents(entry.contributionCents)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.planId?.slice(0, 8) ?? '--'}...
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalCount > limit && (
              <div className="flex items-center justify-between pt-4">
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
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RiskPoolHistorySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
