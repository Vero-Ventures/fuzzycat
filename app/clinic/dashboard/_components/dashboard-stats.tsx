import { AlertCircle, CheckCircle2, Clock, DollarSign, FileText, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCents } from '@/lib/utils/money';

export interface DashboardStatsData {
  activePlans: number;
  completedPlans: number;
  defaultedPlans: number;
  totalPlans: number;
  totalRevenueCents: number;
  totalPayoutCents: number;
  pendingPayoutsCount: number;
  pendingPayoutsCents: number;
  recentEnrollments: Array<{
    id: string;
    ownerName: string | null;
    petName: string | null;
    totalBillCents: number;
    status: string;
    createdAt: Date;
  }>;
}

export function DashboardStats({ data }: { data: DashboardStatsData }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Active Plans */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.activePlans}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.totalPlans} total plan{data.totalPlans !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>

      {/* Total Outstanding */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCents(data.pendingPayoutsCents)}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.pendingPayoutsCount} pending payout{data.pendingPayoutsCount !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>

      {/* Revenue MTD */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Revenue Earned</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCents(data.totalRevenueCents)}</div>
          <p className="mt-1 text-xs text-muted-foreground">3% platform administration share</p>
        </CardContent>
      </Card>

      {/* Overdue / Default */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Received</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCents(data.totalPayoutCents)}</div>
          <div className="mt-1 flex items-center gap-2">
            {data.completedPlans > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3" />
                {data.completedPlans} completed
              </span>
            )}
            {data.defaultedPlans > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {data.defaultedPlans} defaulted
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardStatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="mb-2 h-8 w-32" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
