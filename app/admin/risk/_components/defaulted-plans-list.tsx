'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
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

export function DefaultedPlansList() {
  const trpc = useTRPC();
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const { data, isLoading, error } = useQuery(
    trpc.admin.getDefaultedPlans.queryOptions({ limit, offset }),
  );

  const totalCount = data?.pagination.totalCount ?? 0;
  const hasNextPage = offset + limit < totalCount;
  const hasPrevPage = offset > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Defaulted Plans</CardTitle>
        <CardDescription>
          Plans where the pet owner failed to make payments after all retry attempts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <DefaultedPlansSkeleton />
        ) : error ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Unable to load defaulted plans.
          </p>
        ) : !data || data.plans.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No defaulted plans. All payment plans are in good standing.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner</TableHead>
                  <TableHead>Pet</TableHead>
                  <TableHead>Clinic</TableHead>
                  <TableHead>Total Bill</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Default Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{plan.ownerName ?? 'Unknown'}</span>
                        {plan.ownerEmail && (
                          <p className="text-xs text-muted-foreground">{plan.ownerEmail}</p>
                        )}
                        {plan.ownerPhone && (
                          <p className="text-xs text-muted-foreground">{plan.ownerPhone}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{plan.petName ?? '--'}</TableCell>
                    <TableCell>{plan.clinicName ?? 'Unknown'}</TableCell>
                    <TableCell>{formatCents(plan.totalBillCents)}</TableCell>
                    <TableCell className="font-medium text-destructive">
                      {formatCents(plan.remainingCents)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(plan.updatedAt)}
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

function DefaultedPlansSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
