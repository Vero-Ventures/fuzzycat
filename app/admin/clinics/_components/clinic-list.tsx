'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTRPC } from '@/lib/trpc/client';
import { formatDate } from '@/lib/utils/date';
import { formatCents } from '@/lib/utils/money';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  pending: 'secondary',
  suspended: 'destructive',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  pending: 'Pending',
  suspended: 'Suspended',
};

type ClinicStatusFilter = 'all' | 'pending' | 'active' | 'suspended';

export function ClinicList() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ClinicStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const { data, isLoading, error } = useQuery(
    trpc.admin.getClinics.queryOptions({
      status: statusFilter === 'all' ? undefined : statusFilter,
      search: search || undefined,
      limit,
      offset,
    }),
  );

  const updateStatusMutation = useMutation(
    trpc.admin.updateClinicStatus.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.admin.getClinics.queryKey() });
      },
    }),
  );

  function handleStatusChange(filter: string) {
    setStatusFilter(filter as ClinicStatusFilter);
    setOffset(0);
  }

  function handleSearch(value: string) {
    setSearch(value);
    setOffset(0);
  }

  function handleApprove(clinicId: string) {
    updateStatusMutation.mutate({ clinicId, status: 'active' });
  }

  function handleSuspend(clinicId: string) {
    updateStatusMutation.mutate({ clinicId, status: 'suspended' });
  }

  const totalCount = data?.pagination.totalCount ?? 0;
  const hasNextPage = offset + limit < totalCount;
  const hasPrevPage = offset > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clinics</CardTitle>
        <CardDescription>Manage registered veterinary clinics on the platform.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={statusFilter} onValueChange={handleStatusChange}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="suspended">Suspended</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <ClinicListSkeleton />
        ) : error ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Unable to load clinics.</p>
        ) : !data || data.clinics.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No clinics found matching your filters.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enrollments</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Stripe</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.clinics.map((clinic) => (
                  <TableRow key={clinic.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{clinic.name}</span>
                        <p className="text-xs text-muted-foreground">{clinic.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[clinic.status] ?? 'secondary'}>
                        {STATUS_LABEL[clinic.status] ?? clinic.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{clinic.enrollmentCount}</TableCell>
                    <TableCell>{formatCents(clinic.totalRevenueCents)}</TableCell>
                    <TableCell>
                      <Badge variant={clinic.stripeConnected ? 'default' : 'outline'}>
                        {clinic.stripeConnected ? 'Connected' : 'Not Connected'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(clinic.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {clinic.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApprove(clinic.id)}
                            disabled={updateStatusMutation.isPending}
                          >
                            Approve
                          </Button>
                        )}
                        {clinic.status === 'active' && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleSuspend(clinic.id)}
                            disabled={updateStatusMutation.isPending}
                          >
                            Suspend
                          </Button>
                        )}
                        {clinic.status === 'suspended' && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApprove(clinic.id)}
                            disabled={updateStatusMutation.isPending}
                          >
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-2">
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
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ClinicListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
