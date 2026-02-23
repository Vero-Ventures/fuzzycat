'use client';

import { useQuery } from '@tanstack/react-query';
import { DollarSign, Shield, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useTRPC } from '@/lib/trpc/client';
import { formatCents } from '@/lib/utils/money';

export function RiskPoolDashboard() {
  const trpc = useTRPC();
  const balanceQuery = useQuery(trpc.admin.riskPoolBalance.queryOptions());
  const healthQuery = useQuery(trpc.admin.riskPoolHealth.queryOptions());

  if (balanceQuery.isLoading || healthQuery.isLoading) {
    return <RiskPoolDashboardSkeleton />;
  }

  if (balanceQuery.error || healthQuery.error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Unable to load platform reserve data.</p>
        </CardContent>
      </Card>
    );
  }

  const balance = balanceQuery.data;
  const health = healthQuery.data;

  if (!balance || !health) return null;

  const coveragePercent = Math.min(Math.round(health.coverageRatio * 100), 100);
  const healthStatus =
    health.coverageRatio >= 1 ? 'Fully Funded' : health.coverageRatio >= 0.5 ? 'Adequate' : 'Low';

  return (
    <div className="space-y-4">
      {/* Key metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Reserve Balance */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reserve Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCents(balance.balanceCents)}</div>
            <p className="text-xs text-muted-foreground mt-1">Net platform reserve</p>
          </CardContent>
        </Card>

        {/* Total Contributions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contributions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCents(balance.totalContributionsCents)}</div>
            <p className="text-xs text-muted-foreground mt-1">1% of each enrollment</p>
          </CardContent>
        </Card>

        {/* Active Plans */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.activePlanCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently in repayment</p>
          </CardContent>
        </Card>
      </div>

      {/* Coverage ratio */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Reserve Health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {formatCents(health.balanceCents)} reserve /{' '}
              {formatCents(health.outstandingGuaranteesCents)} outstanding
            </span>
            <span className="text-sm font-medium">{healthStatus}</span>
          </div>
          <Progress value={coveragePercent} className="h-3" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{coveragePercent}% coverage ratio</span>
            <span>
              {health.activePlanCount} active plan{health.activePlanCount !== 1 ? 's' : ''}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RiskPoolDashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
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
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-3 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
