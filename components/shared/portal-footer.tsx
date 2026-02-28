import Link from 'next/link';

export function PortalFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
        <p>&copy; {new Date().getFullYear()} Fuzzycat Billing Solutions</p>
        <nav className="flex flex-wrap items-center gap-4">
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            Terms of Service
          </Link>
          <Link href="/api-docs" className="transition-colors hover:text-foreground">
            API Documentation
          </Link>
          <Link href="/support" className="transition-colors hover:text-foreground">
            Support
          </Link>
        </nav>
      </div>
    </footer>
  );
}
