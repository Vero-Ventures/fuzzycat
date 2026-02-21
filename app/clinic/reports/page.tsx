import { DefaultRateCard } from './_components/default-rate-card';
import { EnrollmentTrends } from './_components/enrollment-trends';
import { ExportButtons } from './_components/export-buttons';
import { RevenueReport } from './_components/revenue-report';

export default function ClinicReportsPage() {
  return (
    <div className="container mx-auto max-w-5xl px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-1">
          View revenue reports, enrollment trends, and export your data.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DefaultRateCard />
      </div>

      <RevenueReport />
      <EnrollmentTrends />
      <ExportButtons />
    </div>
  );
}
