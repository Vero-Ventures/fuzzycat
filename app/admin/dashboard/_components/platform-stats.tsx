'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, DollarSign, FileText, Shield, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTRPC } from '@/lib/trpc/client';
import { formatCents } from '@/lib/utils/money';

export function PlatformStats() {
  const trpc = useTRPC();
  const statsQuery = useQuery(trpc.admin.getPlatformStats.queryOptions());
  const riskQuery = useQuery(trpc.admin.riskPoolHealth.queryOptions());

  if (statsQuery.isLoading || riskQuery.isLoading) {
    return <PlatformStatsSkeleton />;
  }

  if (statsQuery.error || riskQuery.error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Unable to load platform statistics.</p>
        </CardContent>
      </Card>
    );
  }

  const stats = statsQuery.data;
  const riskHealth = riskQuery.data;

  if (!stats || !riskHealth) return null;

  const coveragePercent = Math.round(riskHealth.coverageRatio * 100);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {/* Total Enrollments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalEnrollments}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.activePlans} active plan{stats.activePlans !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>

      {/* Total Revenue */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCents(stats.totalRevenueCents)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatCents(stats.totalFeesCents)} in platform fees
          </p>
        </CardContent>
      </Card>

      {/* Completed Plans */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed Plans</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.completedPlans}</div>
          <p className="text-xs text-muted-foreground mt-1">Successfully paid in full</p>
        </CardContent>
      </Card>

      {/* Default Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Default Rate</CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.defaultRate}%</div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.defaultedPlans} defaulted plan{stats.defaultedPlans !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>

      {/* Platform Reserve Health */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Platform Reserve</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCents(riskHealth.balanceCents)}</div>
          <p className="text-xs text-muted-foreground mt-1">{coveragePercent}% coverage ratio</p>
        </CardContent>
      </Card>
    </div>
  );
}

function PlatformStatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
