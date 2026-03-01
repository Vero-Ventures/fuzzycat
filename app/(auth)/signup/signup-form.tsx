'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Captcha } from '@/components/shared/captcha';
import { signUpClinic, signUpOwner } from './actions';

type Tab = 'owner' | 'clinic';

export function SignupForm() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('owner');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<string | null>(null);

  const handleCaptchaVerify = useCallback((token: string) => {
    setCaptchaToken(token);
  }, []);

  const handleCaptchaError = useCallback(() => {
    setCaptchaToken(null);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      if (captchaToken) {
        formData.set('captchaToken', captchaToken);
      }
      const result = tab === 'owner' ? await signUpOwner(formData) : await signUpClinic(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.needsEmailConfirmation) {
        setEmailSent(formData.get('email') as string);
        return;
      }

      router.push(tab === 'owner' ? '/owner/payments' : '/clinic/dashboard');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (emailSent) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <svg
            className="h-6 w-6 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            role="img"
            aria-label="Email icon"
          >
            <title>Email icon</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to <strong>{emailSent}</strong>. Click the link in the email
          to activate your account.
        </p>
        <p className="text-xs text-muted-foreground">
          Didn&apos;t receive it? Check your spam folder, or{' '}
          <button
            type="button"
            onClick={() => setEmailSent(null)}
            className="font-medium text-primary hover:text-primary/80"
          >
            try again
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Account type" className="flex rounded-md border border-input">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'owner'}
          aria-controls="signup-panel"
          onClick={() => setTab('owner')}
          className={`flex-1 rounded-l-md px-4 py-2 text-sm font-medium ${
            tab === 'owner'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-foreground hover:bg-muted'
          }`}
        >
          Pet Owner
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'clinic'}
          aria-controls="signup-panel"
          onClick={() => setTab('clinic')}
          className={`flex-1 rounded-r-md px-4 py-2 text-sm font-medium ${
            tab === 'clinic'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-foreground hover:bg-muted'
          }`}
        >
          Veterinary Clinic
        </button>
      </div>

      <form id="signup-panel" role="tabpanel" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-foreground">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {tab === 'owner' ? <OwnerFields /> : <ClinicFields />}

        <Captcha onVerify={handleCaptchaVerify} onError={handleCaptchaError} className="my-2" />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </div>
  );
}

function OwnerFields() {
  return (
    <>
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-foreground">
          Full name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-foreground">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div>
        <label htmlFor="petName" className="block text-sm font-medium text-foreground">
          Pet name
        </label>
        <input
          id="petName"
          name="petName"
          type="text"
          required
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    </>
  );
}

function ClinicFields() {
  return (
    <>
      <div>
        <label htmlFor="clinicName" className="block text-sm font-medium text-foreground">
          Clinic name
        </label>
        <input
          id="clinicName"
          name="clinicName"
          type="text"
          required
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-foreground">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="addressState" className="block text-sm font-medium text-foreground">
            State
          </label>
          <input
            id="addressState"
            name="addressState"
            type="text"
            required
            maxLength={2}
            placeholder="CA"
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label htmlFor="addressZip" className="block text-sm font-medium text-foreground">
            ZIP code
          </label>
          <input
            id="addressZip"
            name="addressZip"
            type="text"
            required
            maxLength={10}
            placeholder="94105"
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
    </>
  );
}
