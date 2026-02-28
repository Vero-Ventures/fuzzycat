'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CreditCard, FileText } from 'lucide-react';
import Link from 'next/link';
import { AvatarInitials } from '@/components/shared/avatar-initials';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useTRPC } from '@/lib/trpc/client';
import { formatDate } from '@/lib/utils/date';
import { formatCents } from '@/lib/utils/money';

export default function OwnerPlansPage() {
  const trpc = useTRPC();
  const { data: plans, isLoading, error } = useQuery(trpc.owner.getPlans.queryOptions());

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-32" />
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="mt-2 h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold">My Plans</h1>
        <Card className="mt-8">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Unable to load your plans.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allPlans = plans ?? [];
  const activePlans = allPlans.filter(
    (p) => p.status === 'active' || p.status === 'deposit_paid' || p.status === 'pending',
  );
  const totalOutstanding = allPlans.reduce(
    (sum, p) => sum + Math.max(0, p.totalWithFeeCents - p.totalPaidCents),
    0,
  );
  const nextPaymentPlan = activePlans.find((p) => p.nextPaymentAt);
  const nextPaymentDate = nextPaymentPlan?.nextPaymentAt;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight">My Plans</h1>
      <p className="mt-1 text-muted-foreground">View and manage all your payment plans.</p>

      {/* Stat cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePlans.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCents(totalOutstanding)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Payment</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {nextPaymentDate ? formatDate(nextPaymentDate) : '--'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan cards grid */}
      {allPlans.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CreditCard className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">No payment plans yet</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              When you enroll in a payment plan, it will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {allPlans.map((plan) => {
            const totalExpected = 1 + plan.numInstallments;
            const progressPercent =
              totalExpected > 0 ? Math.round((plan.succeededCount / totalExpected) * 100) : 0;
            const petName = plan.clinicName ?? 'Pet';

            return (
              <Card key={plan.id}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <AvatarInitials name={petName} size="md" />
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{plan.clinicName ?? 'Unknown Clinic'}</h3>
                          <p className="text-xs text-muted-foreground">
                            Plan {plan.id.slice(0, 8)}
                          </p>
                        </div>
                        {plan.status === 'active' ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                            ON TRACK
                          </Badge>
                        ) : (
                          <StatusBadge status={plan.status} size="sm" />
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Total</p>
                          <p className="font-medium">{formatCents(plan.totalWithFeeCents)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Remaining</p>
                          <p className="font-medium">
                            {formatCents(Math.max(0, plan.totalWithFeeCents - plan.totalPaidCents))}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            {plan.succeededCount} of {totalExpected} payments
                          </span>
                          <span>{progressPercent}%</span>
                        </div>
                        <Progress value={progressPercent} className="mt-1 h-2" />
                      </div>

                      <div className="mt-3">
                        <Link
                          href={`/owner/plans/${plan.id}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
