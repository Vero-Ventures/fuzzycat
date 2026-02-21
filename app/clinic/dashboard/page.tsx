import { DashboardStats } from './_components/dashboard-stats';
import { InitiateEnrollmentButton } from './_components/initiate-enrollment-button';
import { RecentEnrollments } from './_components/recent-enrollments';
import { RevenueTable } from './_components/revenue-table';

export default function ClinicDashboardPage() {
  return (
    <div className="container mx-auto max-w-5xl px-6 py-8 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clinic Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage payment plans, track revenue, and monitor payouts.
          </p>
        </div>
        <InitiateEnrollmentButton />
      </div>

      <DashboardStats />
      <RecentEnrollments />
      <RevenueTable />
    </div>
  );
}
