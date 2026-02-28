import { PlatformStats } from './_components/platform-stats';
import { RecentActivity } from './_components/recent-activity';

export default function AdminDashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Overview</h1>
        <p className="mt-1 text-muted-foreground">Platform-wide metrics and recent activity.</p>
      </div>

      <div className="mt-8">
        <PlatformStats />
      </div>

      <div className="mt-8">
        <RecentActivity />
      </div>
    </div>
  );
}
