import { Cat } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = {
  title: {
    template: '%s | FuzzyCat',
    default: 'FuzzyCat - Flexible Payment Plans for Veterinary Care',
  },
  description:
    'Pay your vet bill in easy biweekly installments. No credit check. Flat 6% fee. Clinics earn 3% on every enrollment.',
};

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Cat className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold tracking-tight">FuzzyCat</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href="/how-it-works"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            How It Works
          </Link>
          <ThemeToggle />
          <Link href="/login/clinic">
            <Button variant="outline" size="sm">
              Clinic Portal
            </Button>
          </Link>
          <Link href="/login/owner">
            <Button size="sm">Pet Owner Portal</Button>
          </Link>
        </nav>
        <nav className="flex items-center gap-2 md:hidden">
          <Link
            href="/how-it-works"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            How It Works
          </Link>
          <ThemeToggle />
          <Link href="/login/clinic">
            <Button variant="outline" size="sm">
              Clinic
            </Button>
          </Link>
          <Link href="/login/owner">
            <Button size="sm">Owner</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t bg-muted/50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <Cat className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">FuzzyCat</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Flexible payment plans for veterinary care. No credit check. No surprises.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Pet Owners</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/how-it-works" className="transition-colors hover:text-foreground">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/signup/owner" className="transition-colors hover:text-foreground">
                  Sign Up
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Veterinary Clinics</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/how-it-works" className="transition-colors hover:text-foreground">
                  Clinic Benefits
                </Link>
              </li>
              <li>
                <Link href="/signup/clinic" className="transition-colors hover:text-foreground">
                  Partner With Us
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <Separator className="my-8" />
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} FuzzyCat. All rights reserved. FuzzyCat is a payment
            facilitation platform. Not a lender.
          </p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
