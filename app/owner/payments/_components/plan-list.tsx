'use client';

import { useQuery } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTRPC } from '@/lib/trpc/client';
import { PlanCard } from './plan-card';

export function PlanList() {
  const trpc = useTRPC();
  const { data: plans, isLoading, error } = useQuery(trpc.owner.getPlans.queryOptions());

  if (isLoading) {
    return <PlanListSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Unable to load your payment plans.</p>
        </CardContent>
      </Card>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No payment plans yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            When you enroll in a payment plan, it will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Separate active plans from completed/cancelled
  const activePlans = plans.filter(
    (p) => p.status === 'active' || p.status === 'deposit_paid' || p.status === 'pending',
  );
  const completedPlans = plans.filter(
    (p) => p.status === 'completed' || p.status === 'defaulted' || p.status === 'cancelled',
  );

  return (
    <div className="space-y-6">
      {activePlans.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Active Plans</h2>
          {activePlans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}

      {completedPlans.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-muted-foreground">Past Plans</h2>
          {completedPlans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlanListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <Card key={i}>
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-2 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
