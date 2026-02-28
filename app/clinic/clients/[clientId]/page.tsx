'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { AvatarInitials } from '@/components/shared/avatar-initials';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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

export default function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const trpc = useTRPC();

  const { data, isLoading, error } = useQuery(
    trpc.clinic.getClientDetails.queryOptions({ planId: clientId }),
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-6 w-64" />
        <div className="mt-8 space-y-6">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">Unable to load client details.</p>
      </div>
    );
  }

  const { owner, plans, clientSince } = data;
  const ownerName = owner.name ?? 'Unknown';

  // Aggregate across all plans
  const totalOutstandingCents = plans.reduce(
    (sum, p) => sum + Math.max(0, p.totalWithFeeCents - p.totalPaidCents),
    0,
  );
  const totalWithFeeCentsAll = plans.reduce((sum, p) => sum + p.totalWithFeeCents, 0);
  const uniquePetNames = [...new Set(plans.map((p) => p.petName).filter(Boolean))];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/clinic/clients" className="hover:text-foreground">
          Clients
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{ownerName}</span>
      </nav>

      {/* Client profile card */}
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <AvatarInitials name={ownerName} size="lg" />
          <div className="flex-1">
            <h1 className="text-xl font-bold">{ownerName}</h1>
            <div className="mt-1 flex flex-wrap gap-4 text-sm text-muted-foreground">
              {owner.email && <span>{owner.email}</span>}
              {owner.phone && <span>{owner.phone}</span>}
            </div>
          </div>
          {clientSince && (
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Client since {formatDate(clientSince)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">TOTAL PLANS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plans.length}</div>
            <p className="text-xs text-muted-foreground">
              {uniquePetNames.length > 0 ? uniquePetNames.join(', ') : 'No pets'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">OUTSTANDING</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCents(totalOutstandingCents)}</div>
            <p className="text-xs text-muted-foreground">
              of {formatCents(totalWithFeeCentsAll)} total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ACTIVE PLANS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {plans.filter((p) => p.status === 'active' || p.status === 'deposit_paid').length}
            </div>
            <p className="text-xs text-muted-foreground">currently in progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Financial plans table */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Financial Plans</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Pet</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => {
                const paidRatio =
                  plan.totalWithFeeCents > 0
                    ? Math.round((plan.totalPaidCents / plan.totalWithFeeCents) * 100)
                    : 0;

                return (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.id.slice(0, 8)}</TableCell>
                    <TableCell>{plan.petName ?? '--'}</TableCell>
                    <TableCell>
                      <StatusBadge status={plan.status} size="sm" />
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCents(plan.totalWithFeeCents)}
                    </TableCell>
                    <TableCell className="text-right">{formatCents(plan.totalPaidCents)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={paidRatio} className="h-2 w-20" />
                        <span className="text-xs text-muted-foreground">{paidRatio}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/clinic/clients/${clientId}/plans/${plan.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Details
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
