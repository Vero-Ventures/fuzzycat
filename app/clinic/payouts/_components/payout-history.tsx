'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

const PAGE_SIZE = 20;

export function PayoutHistory() {
  const trpc = useTRPC();
  const [offset, setOffset] = useState(0);

  // Get clinic profile for the clinicId
  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
  } = useQuery(trpc.clinic.getProfile.queryOptions());

  const {
    data: historyData,
    isLoading: historyLoading,
    error: historyError,
  } = useQuery(
    trpc.payout.history.queryOptions(
      { clinicId: profile?.id ?? '', limit: PAGE_SIZE, offset },
      { enabled: !!profile?.id },
    ),
  );

  const isLoading = profileLoading || historyLoading;
  const error = profileError || historyError;

  if (isLoading) {
    return <PayoutHistorySkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Unable to load payout history.</p>
        </CardContent>
      </Card>
    );
  }

  const payoutsList = historyData?.payouts ?? [];
  const total = historyData?.total ?? 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payout History</CardTitle>
        <CardDescription>Complete record of all payouts to your bank account.</CardDescription>
      </CardHeader>
      <CardContent>
        {payoutsList.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No payouts yet. Payouts will appear here after pet owners make their payments.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">3% Share</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Transfer ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payoutsList.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDate(payout.createdAt)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCents(payout.amountCents)}
                    </TableCell>
                    <TableCell className="text-right text-primary font-medium">
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
                      >
                        {payout.status === 'succeeded'
                          ? 'Succeeded'
                          : payout.status === 'failed'
                            ? 'Failed'
                            : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {payout.stripeTransferId ?? '--'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages} ({total} total)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                    disabled={offset === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                    disabled={currentPage >= totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
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

function PayoutHistorySkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
