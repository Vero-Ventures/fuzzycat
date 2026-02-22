'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
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
import { ClientPlanDetails } from './client-plan-details';

type PlanStatus = 'pending' | 'deposit_paid' | 'active' | 'completed' | 'defaulted' | 'cancelled';

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
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

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
    pageSize: 20,
  };

  const { data, isLoading, error } = useQuery(trpc.clinic.getClients.queryOptions(queryInput));

  function handleStatusChange(value: string) {
    setStatusFilter(value as PlanStatus | 'all');
    setPage(1);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client Plans</CardTitle>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by owner name or pet name..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
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
        {isLoading ? (
          <ClientListSkeleton />
        ) : error ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Unable to load client list.
          </p>
        ) : !data || data.clients.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {debouncedSearch || statusFilter !== 'all'
              ? 'No clients match your search criteria.'
              : 'No clients yet. Enroll your first pet owner to get started.'}
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner</TableHead>
                  <TableHead>Pet</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Bill</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Next Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.clients.map((client) => (
                  <ClientRow
                    key={client.planId}
                    client={client}
                    isExpanded={expandedPlanId === client.planId}
                    onToggle={() =>
                      setExpandedPlanId(expandedPlanId === client.planId ? null : client.planId)
                    }
                  />
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Page {data.pagination.page} of {data.pagination.totalPages} (
                  {data.pagination.totalCount} total)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= data.pagination.totalPages}
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

interface ClientRowProps {
  client: {
    planId: string;
    ownerName: string | null;
    ownerEmail: string | null;
    ownerPhone: string | null;
    petName: string | null;
    totalBillCents: number;
    totalWithFeeCents: number;
    planStatus: string;
    nextPaymentAt: Date | string | null;
    createdAt: Date | string | null;
    totalPaidCents: number;
  };
  isExpanded: boolean;
  onToggle: () => void;
}

function ClientRow({ client, isExpanded, onToggle }: ClientRowProps) {
  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell className="font-medium">{client.ownerName ?? 'Unknown'}</TableCell>
        <TableCell>{client.petName ?? '--'}</TableCell>
        <TableCell>
          <Badge variant={STATUS_VARIANT[client.planStatus] ?? 'secondary'}>
            {STATUS_LABEL[client.planStatus] ?? client.planStatus}
          </Badge>
        </TableCell>
        <TableCell className="text-right">{formatCents(client.totalBillCents)}</TableCell>
        <TableCell className="text-right">{formatCents(client.totalPaidCents)}</TableCell>
        <TableCell className="text-muted-foreground">
          {client.nextPaymentAt ? formatDate(client.nextPaymentAt) : '--'}
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30 p-0">
            <ClientPlanDetails planId={client.planId} />
          </TableCell>
        </TableRow>
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
