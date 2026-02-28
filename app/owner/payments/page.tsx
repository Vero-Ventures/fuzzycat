import { DashboardSummary } from './_components/dashboard-summary';
import { PlanList } from './_components/plan-list';
import { QuickLinks } from './_components/quick-links';
import { RecentPayments } from './_components/recent-payments';

export default function OwnerPaymentsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <DashboardSummary />

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <PlanList />
          <RecentPayments />
        </div>
        <div>
          <QuickLinks />
        </div>
      </div>
    </div>
  );
}
