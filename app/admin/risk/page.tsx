import { DefaultedPlansList } from './_components/defaulted-plans-list';
import { RiskPoolDashboard } from './_components/risk-pool-dashboard';
import { RiskPoolHistory } from './_components/risk-pool-history';

export default function AdminRiskPage() {
  return (
    <div className="container mx-auto max-w-6xl px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Risk Pool</h1>
        <p className="text-muted-foreground mt-1">
          Monitor the guarantee fund, coverage health, and defaulted plans.
        </p>
      </div>

      <RiskPoolDashboard />
      <DefaultedPlansList />
      <RiskPoolHistory />
    </div>
  );
}
