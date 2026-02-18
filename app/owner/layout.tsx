import { redirect } from 'next/navigation';
import { getUserRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const role = getUserRole(user);
  if (role !== 'owner' && role !== 'admin') {
    redirect('/login');
  }

  return <>{children}</>;
}
