import { PlatformStats } from './_components/platform-stats';
import { RecentActivity } from './_components/recent-activity';

export default function AdminDashboardPage() {
  return (
    <div className="container mx-auto max-w-6xl px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Platform-wide metrics and recent activity.</p>
      </div>

      <PlatformStats />
      <RecentActivity />
    </div>
  );
}
