import { Building2, User } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Log In | FuzzyCat',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const { redirectTo, error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Log in to FuzzyCat</h1>
          <p className="mt-2 text-sm text-muted-foreground">Choose your portal or sign in below</p>
        </div>

        {/* Portal routing buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/login/clinic">
            <Button variant="outline" className="w-full gap-2">
              <Building2 className="h-4 w-4" />
              Clinic Portal
            </Button>
          </Link>
          <Link href="/login/owner">
            <Button variant="outline" className="w-full gap-2">
              <User className="h-4 w-4" />
              Pet Owner
            </Button>
          </Link>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or sign in directly</span>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive"
          >
            {error === 'auth_callback_failed'
              ? 'Authentication failed. Please try again.'
              : 'An error occurred. Please try again.'}
          </div>
        )}
        <LoginForm redirectTo={redirectTo} />
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-medium text-primary hover:text-primary/80">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
