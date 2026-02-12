'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function MfaSetupPage() {
  const router = useRouter();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function enroll() {
      const supabase = createClient();
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'FuzzyCat Authenticator',
      });

      if (enrollError) {
        setError(enrollError.message);
        return;
      }

      if (data.type === 'totp') {
        setQrCode(data.totp.qr_code);
        setFactorId(data.id);
      }
    }

    enroll();
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;

    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });

    if (challengeError) {
      setError(challengeError.message);
      setLoading(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: verifyCode,
    });

    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Set up two-factor authentication</h1>
          <p className="mt-2 text-sm text-gray-600">
            Scan the QR code with your authenticator app, then enter the verification code.
          </p>
        </div>

        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {qrCode && (
          <div className="flex justify-center">
            {/* biome-ignore lint/performance/noImgElement: QR code is a data URI, next/image does not support data URIs */}
            <img src={qrCode} alt="TOTP QR Code" className="h-48 w-48" />
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700">
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
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              placeholder="000000"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !factorId}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify and enable'}
          </button>
        </form>
      </div>
    </div>
  );
}
