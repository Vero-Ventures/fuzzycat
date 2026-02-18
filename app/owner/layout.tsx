import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const role = (user.app_metadata?.role as string) ?? 'owner';
  if (role !== 'owner' && role !== 'admin') {
    redirect('/login');
  }

  return <>{children}</>;
}
