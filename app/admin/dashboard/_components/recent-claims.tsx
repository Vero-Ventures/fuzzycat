'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

export function RecentClaims() {
  const trpc = useTRPC();
  const { data, isLoading, error } = useQuery(
    trpc.admin.getRiskPoolDetails.queryOptions({ limit: 5, offset: 0 }),
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Unable to load claims.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Guarantee Claims</CardTitle>
        <Link href="/admin/risk" className="text-sm font-medium text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {data.entries.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No risk pool entries yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <Badge variant={TYPE_VARIANT[entry.type] ?? 'secondary'}>
                      {TYPE_LABEL[entry.type] ?? entry.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatCents(entry.contributionCents)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(entry.createdAt)}
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
