'use client';

import { Building2, CreditCard, LayoutDashboard, LogOut, Shield } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Clinics', href: '/admin/clinics', icon: Building2 },
  { label: 'Payments', href: '/admin/payments', icon: CreditCard },
  { label: 'Risk Pool', href: '/admin/risk', icon: Shield },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      {/* Logo / Brand */}
      <div className="flex h-16 items-center px-6">
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold tracking-tight">FuzzyCat Admin</span>
        </Link>
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

      {/* Footer */}
      <div className="flex items-center justify-between p-3">
        <form action="/api/auth/signout" method="POST">
          <Button variant="ghost" className="justify-start gap-3 text-muted-foreground">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </form>
        <ThemeToggle />
      </div>
    </aside>
  );
}
