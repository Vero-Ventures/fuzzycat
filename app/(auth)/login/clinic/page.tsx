'use client';

import { Cat } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getUserRole, ROLE_HOME } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';

export default function ClinicLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        if (signInError.message === 'Email not confirmed') {
          setError('Please check your email and confirm your account before signing in.');
        } else {
          setError(signInError.message);
        }
        return;
      }

      const role = data.user ? getUserRole(data.user) : 'clinic';
      router.push(ROLE_HOME[role]);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-50 to-white px-4 dark:from-teal-950/30 dark:to-background">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 shadow-sm">
        <div className="text-center">
          <Cat className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h1 className="text-2xl font-bold">Clinic Portal Login</h1>
          <p className="mt-1 text-sm text-muted-foreground">Access your clinic dashboard</p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5"
              placeholder="clinic@example.com"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div className="flex items-center justify-end">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-primary hover:text-primary/80"
            >
              Forgot password?
            </Link>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have a clinic account?{' '}
          <Link href="/signup/clinic" className="font-medium text-primary hover:text-primary/80">
            Register your clinic here
          </Link>
        </p>

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
