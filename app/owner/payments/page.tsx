import { DashboardSummary } from './_components/dashboard-summary';
import { PlanList } from './_components/plan-list';

export default function OwnerPaymentsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Payment Plans</h1>
        <p className="text-muted-foreground mt-1">
          Track your payment progress and upcoming installments.
        </p>
      </div>

      <DashboardSummary />
      <PlanList />
    </div>
  );
}
