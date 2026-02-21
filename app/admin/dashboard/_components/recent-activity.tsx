'use client';

import { useQuery } from '@tanstack/react-query';
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

const ACTION_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  created: 'default',
  status_changed: 'secondary',
  retried: 'outline',
  defaulted: 'destructive',
  claimed: 'destructive',
  contributed: 'default',
  recovered: 'outline',
};

const ACTION_LABEL: Record<string, string> = {
  created: 'Created',
  status_changed: 'Status Changed',
  retried: 'Retried',
  defaulted: 'Defaulted',
  claimed: 'Claimed',
  contributed: 'Contributed',
  recovered: 'Recovered',
};

export function RecentActivity() {
  const trpc = useTRPC();
  const { data, isLoading, error } = useQuery(
    trpc.admin.getRecentAuditLog.queryOptions({ limit: 20 }),
  );

  if (isLoading) {
    return <RecentActivitySkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Unable to load recent activity.</p>
        </CardContent>
      </Card>
    );
  }

  const entries = data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest audit log entries across the platform.</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No activity recorded yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <span className="font-medium capitalize">{entry.entityType}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {entry.entityId.slice(0, 8)}...
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ACTION_VARIANT[entry.action] ?? 'secondary'}>
                      {ACTION_LABEL[entry.action] ?? entry.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{entry.actorType}</TableCell>
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

function RecentActivitySkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
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
