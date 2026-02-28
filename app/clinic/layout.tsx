import { redirect } from 'next/navigation';
import { PortalFooter } from '@/components/shared/portal-footer';
import { getAuthFromMiddleware } from '@/lib/auth-from-middleware';
import { enforceMfa } from '@/lib/supabase/mfa';
import { createClient } from '@/lib/supabase/server';
import { ClinicNavbar } from './_components/clinic-navbar';

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
    <div className="flex min-h-screen flex-col">
      <ClinicNavbar />
      <main className="flex-1 bg-background">{children}</main>
      <PortalFooter />
    </div>
  );
}
