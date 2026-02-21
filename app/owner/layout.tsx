import { Cat } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
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

  return (
    <>
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/owner/payments" className="flex items-center gap-2">
            <Cat className="h-5 w-5 text-primary" />
            <span className="font-semibold tracking-tight">FuzzyCat</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/owner/settings"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Settings
            </Link>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
