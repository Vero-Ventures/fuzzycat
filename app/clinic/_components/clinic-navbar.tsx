'use client';

import { LogOut } from 'lucide-react';
import { signOut } from '@/app/(auth)/signout/actions';
import { TopNavbar } from '@/components/shared/top-navbar';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/clinic/dashboard' },
  { label: 'Clients', href: '/clinic/clients' },
  { label: 'Payouts', href: '/clinic/payouts' },
  { label: 'Reports', href: '/clinic/reports' },
  { label: 'Settings', href: '/clinic/settings' },
];

export function ClinicNavbar() {
  return (
    <TopNavbar
      brandHref="/clinic/dashboard"
      navItems={NAV_ITEMS}
      rightSlot={
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <form action={signOut}>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </form>
        </div>
      }
    />
  );
}
