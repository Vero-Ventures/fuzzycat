'use client';

import { Cat, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface NavItem {
  label: string;
  href: string;
}

interface TopNavbarProps {
  brandHref: string;
  navItems: NavItem[];
  rightSlot?: React.ReactNode;
}

export function TopNavbar({ brandHref, navItems, rightSlot }: TopNavbarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const prevPathnameRef = useRef(pathname);

  // Close mobile menu on route change without useEffect
  if (prevPathnameRef.current !== pathname) {
    prevPathnameRef.current = pathname;
    if (menuOpen) {
      setMenuOpen(false);
    }
  }

  const handleNavClick = useCallback(() => {
    setMenuOpen(false);
  }, []);

  return (
    <div className="sticky top-0 z-50">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand */}
          <Link href={brandHref} className="flex items-center gap-2">
            <Cat className="h-5 w-5 text-primary" />
            <span className="font-semibold tracking-tight">Fuzzycat</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute inset-x-0 -bottom-[calc(0.5rem+1px)] h-0.5 bg-primary" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right slot + mobile menu toggle */}
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">{rightSlot}</div>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Teal accent line */}
      <div className="h-0.5 bg-primary" />

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="border-b bg-background md:hidden">
          <nav className="mx-auto max-w-7xl space-y-1 px-4 py-3 sm:px-6">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleNavClick}
                  className={cn(
                    'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t px-4 py-3 sm:px-6">{rightSlot}</div>
        </div>
      )}
    </div>
  );
}
