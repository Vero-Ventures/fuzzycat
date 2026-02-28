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

export default function OwnerLoginPage() {
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

      const role = data.user ? getUserRole(data.user) : 'owner';
      router.push(ROLE_HOME[role]);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel: teal gradient with quote */}
      <div className="hidden items-center justify-center bg-gradient-to-br from-teal-600 to-teal-700 p-12 text-white lg:flex lg:w-[40%]">
        <div className="max-w-sm">
          <Cat className="mb-6 h-12 w-12 text-teal-200" />
          <blockquote className="text-2xl font-semibold leading-relaxed">
            &ldquo;Because your best friend deserves the best care.&rdquo;
          </blockquote>
          <p className="mt-4 text-teal-200">
            Flexible payment plans for veterinary care. No credit check. No interest.
          </p>
        </div>
      </div>

      {/* Right panel: login form */}
      <div className="flex flex-1 items-center justify-center px-4 sm:px-8">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Welcome Back!</h1>
            <p className="mt-2 text-muted-foreground">Sign in to manage your payment plans</p>
          </div>

          {error && (
            <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
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
                placeholder="you@example.com"
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
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-primary hover:text-primary/80"
              >
                Forgot your password?
              </Link>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/signup/owner" className="font-medium text-primary hover:text-primary/80">
              Join the Fuzzycat Family
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
