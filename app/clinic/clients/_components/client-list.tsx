'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { AvatarInitials } from '@/components/shared/avatar-initials';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useTRPC } from '@/lib/trpc/client';
import { formatDate } from '@/lib/utils/date';
import { formatCents } from '@/lib/utils/money';

type PlanStatus = 'pending' | 'deposit_paid' | 'active' | 'completed' | 'defaulted' | 'cancelled';

const STATUS_OPTIONS: { value: PlanStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'deposit_paid', label: 'Deposit Paid' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'defaulted', label: 'Defaulted' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function ClientList() {
  const trpc = useTRPC();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PlanStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  const queryInput = {
    search: debouncedSearch || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
    page,
    pageSize,
  };

  const { data, isLoading, error } = useQuery(trpc.clinic.getClients.queryOptions(queryInput));

  function handleStatusChange(value: string) {
    setStatusFilter(value as PlanStatus | 'all');
    setPage(1);
  }

  const startItem = data ? (data.pagination.page - 1) * pageSize + 1 : 0;
  const endItem = data ? Math.min(data.pagination.page * pageSize, data.pagination.totalCount) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client Plans</CardTitle>

        {/* Full-width search bar + filter */}
        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by owner name or pet name..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <ClientListContent
          isLoading={isLoading}
          error={error}
          data={data}
          debouncedSearch={debouncedSearch}
          statusFilter={statusFilter}
          page={page}
          startItem={startItem}
          endItem={endItem}
          onPageChange={setPage}
        />
      </CardContent>
    </Card>
  );
}

function ClientListContent({
  isLoading,
  error,
  data,
  debouncedSearch,
  statusFilter,
  page,
  startItem,
  endItem,
  onPageChange,
}: {
  isLoading: boolean;
  error: unknown;
  data:
    | {
        clients: {
          planId: string;
          ownerName: string | null;
          ownerEmail: string | null;
          petName: string | null;
          planStatus: string;
          totalBillCents: number;
          totalPaidCents: number;
          nextPaymentAt: Date | null;
        }[];
        pagination: { page: number; totalCount: number; totalPages: number };
      }
    | undefined;
  debouncedSearch: string;
  statusFilter: string;
  page: number;
  startItem: number;
  endItem: number;
  onPageChange: (page: number) => void;
}) {
  if (isLoading) return <ClientListSkeleton />;

  if (error) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">Unable to load client list.</p>
    );
  }

  if (!data || data.clients.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        {debouncedSearch || statusFilter !== 'all'
          ? 'No clients match your search criteria.'
          : 'No clients yet. Enroll your first pet owner to get started.'}
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Owner</TableHead>
              <TableHead>Pet</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Next Payment</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.clients.map((client) => (
              <TableRow key={client.planId}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <AvatarInitials name={client.ownerName ?? 'Unknown'} size="sm" />
                    <div>
                      <p className="font-medium">{client.ownerName ?? 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{client.ownerEmail ?? ''}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{client.petName ?? '--'}</TableCell>
                <TableCell>
                  <StatusBadge status={client.planStatus} size="sm" />
                </TableCell>
                <TableCell className="text-right">
                  {formatCents(client.totalBillCents - client.totalPaidCents)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {client.nextPaymentAt ? formatDate(client.nextPaymentAt) : '--'}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/clinic/clients/${client.planId}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    View
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">
            Showing {startItem} to {endItem} of {data.pagination.totalCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= data.pagination.totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function ClientListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
