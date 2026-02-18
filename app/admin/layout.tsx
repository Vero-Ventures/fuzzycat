import { redirect } from 'next/navigation';
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

  const role = user.app_metadata?.role as string;
  if (role !== 'admin') {
    redirect('/login');
  }

  await enforceMfa(supabase);

  return <>{children}</>;
}
