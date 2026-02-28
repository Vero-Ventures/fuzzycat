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

  // Use getClientPlanDetails since clientId is actually a planId in our data model
  const { data, isLoading, error } = useQuery(
    trpc.clinic.getClientPlanDetails.queryOptions({ planId: clientId }),
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

  const { plan, payments } = data;
  const ownerName = plan.ownerName ?? 'Unknown';
  const succeededPayments = payments.filter((p) => p.status === 'succeeded');
  const totalExpected = 1 + plan.numInstallments;
  const progressPercent =
    totalExpected > 0 ? Math.round((succeededPayments.length / totalExpected) * 100) : 0;
  const totalPaidCents = succeededPayments.reduce((sum, p) => sum + p.amountCents, 0);

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
              {plan.ownerEmail && <span>{plan.ownerEmail}</span>}
              {plan.ownerPhone && <span>{plan.ownerPhone}</span>}
            </div>
          </div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Client since {formatDate(plan.createdAt)}
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">TOTAL PETS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-xs text-muted-foreground">{plan.petName ?? 'Pet'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">OUTSTANDING</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCents(Math.max(0, plan.totalWithFeeCents - totalPaidCents))}
            </div>
            <p className="text-xs text-muted-foreground">
              of {formatCents(plan.totalWithFeeCents)} total
            </p>
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
              <TableRow>
                <TableCell className="font-medium">{plan.id.slice(0, 8)}</TableCell>
                <TableCell>{plan.petName ?? '--'}</TableCell>
                <TableCell>
                  <StatusBadge status={plan.status} size="sm" />
                </TableCell>
                <TableCell className="text-right">{formatCents(plan.totalWithFeeCents)}</TableCell>
                <TableCell className="text-right">{formatCents(totalPaidCents)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={progressPercent} className="h-2 w-20" />
                    <span className="text-xs text-muted-foreground">{progressPercent}%</span>
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
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
