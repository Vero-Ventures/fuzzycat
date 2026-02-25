import { redirect } from 'next/navigation';
import { getAuthFromMiddleware } from '@/lib/auth-from-middleware';
import { enforceMfa } from '@/lib/supabase/mfa';
import { createClient } from '@/lib/supabase/server';
import { ClinicSidebar } from './_components/clinic-sidebar';

export const dynamic = 'force-dynamic';

export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthFromMiddleware();

  if (!auth || (auth.role !== 'clinic' && auth.role !== 'admin')) {
    redirect('/login');
  }

  // Supabase client still needed for MFA enforcement (no getUser() call)
  const supabase = await createClient();
  await enforceMfa(supabase);

  return (
    <div className="flex h-screen overflow-hidden">
      <ClinicSidebar />
      <main className="flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  );
}
