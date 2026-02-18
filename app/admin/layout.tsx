import { redirect } from 'next/navigation';
import { getUserRole } from '@/lib/auth';
import { enforceMfa } from '@/lib/supabase/mfa';
import { createClient } from '@/lib/supabase/server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  if (getUserRole(user) !== 'admin') {
    redirect('/login');
  }

  await enforceMfa(supabase);

  return <>{children}</>;
}
