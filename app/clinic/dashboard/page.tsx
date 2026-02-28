import { DashboardStats } from './_components/dashboard-stats';
import { InitiateEnrollmentButton } from './_components/initiate-enrollment-button';
import { RecentEnrollments } from './_components/recent-enrollments';
import { RevenueTable } from './_components/revenue-table';
import { UpcomingPayments } from './_components/upcoming-payments';

export default function ClinicDashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clinic Overview</h1>
          <p className="mt-1 text-muted-foreground">
            Welcome back. Here is a summary of your clinic activity.
          </p>
        </div>
        <InitiateEnrollmentButton />
      </div>

      <div className="mt-8">
        <DashboardStats />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentEnrollments />
        </div>
        <div>
          <UpcomingPayments />
        </div>
      </div>

      <div className="mt-8">
        <RevenueTable />
      </div>
    </div>
  );
}
