import { redirect } from 'next/navigation';
import { getUserRole } from '@/lib/auth';
import { enforceMfa } from '@/lib/supabase/mfa';
import { createClient } from '@/lib/supabase/server';
import { ClinicSidebar } from './_components/clinic-sidebar';

export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const role = getUserRole(user);
  if (role !== 'clinic' && role !== 'admin') {
    redirect('/login');
  }

  await enforceMfa(supabase);

  return (
    <div className="flex h-screen overflow-hidden">
      <ClinicSidebar />
      <main className="flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  );
}
