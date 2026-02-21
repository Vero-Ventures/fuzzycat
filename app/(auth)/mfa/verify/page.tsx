'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function MfaVerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.find((f) => f.status === 'verified');

      if (!totpFactor) {
        setError('No TOTP factor found. Please set up MFA first.');
        return;
      }

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });

      if (challengeError) {
        setError(challengeError.message);
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code,
      });

      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      router.push('/');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Two-factor authentication</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-foreground">
              Verification code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>
      </div>
    </div>
  );
}
