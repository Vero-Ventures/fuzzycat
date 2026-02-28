'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  active: 'default',
  pending: 'secondary',
  suspended: 'destructive',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  pending: 'Pending',
  suspended: 'Suspended',
};

export function RecentClinics() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery(
    trpc.admin.getClinics.queryOptions({ limit: 5, offset: 0 }),
  );

  const updateStatus = useMutation(
    trpc.admin.updateClinicStatus.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.admin.getClinics.queryKey() });
      },
    }),
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
          <p className="text-sm text-muted-foreground">Unable to load clinics.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Registered Clinics</CardTitle>
        <Link href="/admin/clinics" className="text-sm font-medium text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {data.clinics.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No clinics registered.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.clinics.map((clinic) => (
                <TableRow key={clinic.id}>
                  <TableCell className="font-medium">{clinic.name}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[clinic.status] ?? 'secondary'}>
                      {STATUS_LABEL[clinic.status] ?? clinic.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(clinic.createdAt)}
                  </TableCell>
                  <TableCell>
                    {clinic.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() =>
                          updateStatus.mutate({ clinicId: clinic.id, status: 'active' })
                        }
                        disabled={updateStatus.isPending}
                      >
                        Approve
                      </Button>
                    )}
                    {clinic.status === 'active' && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          updateStatus.mutate({ clinicId: clinic.id, status: 'suspended' })
                        }
                        disabled={updateStatus.isPending}
                      >
                        Suspend
                      </Button>
                    )}
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
