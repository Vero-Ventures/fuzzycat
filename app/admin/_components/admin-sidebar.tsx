'use client';

import {
  Building2,
  Cat,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signOut } from '@/app/(auth)/signout/actions';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Clinics', href: '/admin/clinics', icon: Building2 },
  { label: 'Payments', href: '/admin/payments', icon: CreditCard },
  { label: 'Platform Reserve', href: '/admin/risk', icon: Shield },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close mobile menu on route change
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-run on pathname change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile header bar */}
      <div className="flex h-14 items-center border-b bg-card px-4 md:hidden">
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
        <span className="ml-2 text-sm font-bold">FuzzyCat Admin</span>
      </div>

      {/* Backdrop */}
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card transition-transform md:static md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between px-6">
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <Cat className="h-6 w-6 text-primary" />
            <div className="flex flex-col">
              <span className="text-lg font-bold leading-tight tracking-tight">FuzzyCat Admin</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">
                Internal Portal
              </span>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Separator />

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Separator />

        {/* Footer: user profile area */}
        <div className="p-3">
          <div className="mb-3 flex items-center gap-3 rounded-md px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Settings className="h-4 w-4" />
            </div>
            <div className="flex-1 text-sm">
              <p className="font-medium">Admin</p>
              <p className="text-xs text-muted-foreground">Platform Admin</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <form action={signOut}>
              <Button variant="ghost" className="justify-start gap-3 text-muted-foreground">
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </form>
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  );
}
