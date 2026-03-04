'use client';

import { LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { signOut } from '@/app/(auth)/signout/actions';
import { TopNavbar } from '@/components/shared/top-navbar';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/client/payments' },
  { label: 'Referrals', href: '/client/referrals' },
];

export function ClientNavbar() {
  return (
    <TopNavbar
      brandHref="/client/payments"
      navItems={NAV_ITEMS}
      rightSlot={
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/client/settings"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Link>
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
