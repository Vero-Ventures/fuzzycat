'use client';

import { ArrowLeft, Cat, Mail } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            We sent a password reset link to <strong>{email}</strong>. Click the link in the email
            to set a new password.
          </p>
          <p className="text-xs text-muted-foreground">
            Did not receive the email? Check your spam folder, or{' '}
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="font-medium text-primary hover:text-primary/80"
            >
              try again
            </button>
            .
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Cat className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h1 className="text-2xl font-semibold">Reset your password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your email address and we will send you a link to reset your password.
          </p>
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
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5"
              placeholder="you@example.com"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Sending...' : 'Send reset link'}
          </Button>
        </form>

        <div className="text-center">
          <Link
            href="/login"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
