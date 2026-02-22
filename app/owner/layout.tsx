import { Cat, LogOut } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOut } from '@/app/(auth)/signout/actions';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { getAuthFromMiddleware } from '@/lib/auth-from-middleware';

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthFromMiddleware();

  if (!auth || (auth.role !== 'owner' && auth.role !== 'admin')) {
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
            <form action={signOut}>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
