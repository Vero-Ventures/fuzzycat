import { DefaultedPlansList } from './_components/defaulted-plans-list';
import { RiskPoolDashboard } from './_components/risk-pool-dashboard';
import { RiskPoolHistory } from './_components/risk-pool-history';
import { SoftCollectionsList } from './_components/soft-collections-list';

export default function AdminRiskPage() {
  return (
    <div className="container mx-auto max-w-6xl px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Reserve</h1>
        <p className="text-muted-foreground mt-1">
          Monitor the platform reserve, coverage health, and defaulted plans.
        </p>
      </div>

      <RiskPoolDashboard />
      <SoftCollectionsList />
      <DefaultedPlansList />
      <RiskPoolHistory />
    </div>
  );
}
