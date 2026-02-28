import { Cat } from 'lucide-react';
import Link from 'next/link';
import { ClinicLoginForm } from './_components/clinic-login-form';

export default function ClinicLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-50 to-white px-4 dark:from-teal-950/30 dark:to-background">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 shadow-sm">
        <div className="text-center">
          <Cat className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h1 className="text-2xl font-bold">Clinic Portal Login</h1>
          <p className="mt-1 text-sm text-muted-foreground">Access your clinic dashboard</p>
        </div>

        <ClinicLoginForm />

        <div className="flex justify-center gap-4 text-xs text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
