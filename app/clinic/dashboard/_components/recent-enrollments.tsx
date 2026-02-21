'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
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

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  deposit_paid: 'secondary',
  completed: 'outline',
  pending: 'secondary',
  defaulted: 'destructive',
  cancelled: 'destructive',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  deposit_paid: 'Deposit Paid',
  completed: 'Completed',
  pending: 'Pending',
  defaulted: 'Defaulted',
  cancelled: 'Cancelled',
};

export function RecentEnrollments() {
  const trpc = useTRPC();
  const { data, isLoading, error } = useQuery(trpc.clinic.getDashboardStats.queryOptions());

  if (isLoading) {
    return <RecentEnrollmentsSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Unable to load recent enrollments.</p>
        </CardContent>
      </Card>
    );
  }

  const enrollments = data?.recentEnrollments ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Enrollments</CardTitle>
            <CardDescription>Last 10 payment plans created at your clinic.</CardDescription>
          </div>
          <Link href="/clinic/clients" className="text-sm font-medium text-primary hover:underline">
            View all clients
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No enrollments yet. Create your first payment plan to get started.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pet Owner</TableHead>
                <TableHead>Pet</TableHead>
                <TableHead>Bill Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Enrolled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.map((enrollment) => (
                <TableRow key={enrollment.id}>
                  <TableCell className="font-medium">{enrollment.ownerName ?? 'Unknown'}</TableCell>
                  <TableCell>{enrollment.petName ?? '--'}</TableCell>
                  <TableCell>{formatCents(enrollment.totalBillCents)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[enrollment.status] ?? 'secondary'}>
                      {STATUS_LABEL[enrollment.status] ?? enrollment.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(enrollment.createdAt)}
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

function RecentEnrollmentsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
