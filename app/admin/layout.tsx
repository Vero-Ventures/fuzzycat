import { Search } from 'lucide-react';
import { redirect } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { getAuthFromMiddleware } from '@/lib/auth-from-middleware';
import { enforceMfa } from '@/lib/supabase/mfa';
import { createClient } from '@/lib/supabase/server';
import { AdminSidebar } from './_components/admin-sidebar';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthFromMiddleware();

  if (!auth || auth.role !== 'admin') {
    redirect('/login');
  }

  // Supabase client still needed for MFA enforcement (no getUser() call)
  const supabase = await createClient();
  await enforceMfa(supabase);

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header bar */}
        <header className="flex h-14 items-center justify-between border-b bg-card px-6">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search..." className="pl-9" disabled />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            System Status: Operational
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-background">{children}</main>
      </div>
    </div>
  );
}
