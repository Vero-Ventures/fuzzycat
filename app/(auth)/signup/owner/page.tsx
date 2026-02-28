'use client';

import { Star } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { signUpOwner } from '@/app/(auth)/signup/actions';
import { Captcha } from '@/components/shared/captcha';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function OwnerSignupPage() {
  const router = useRouter();
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
      const result = await signUpOwner(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.needsEmailConfirmation) {
        setEmailSent(formData.get('email') as string);
        return;
      }

      router.push('/owner/payments');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel: gradient + testimonial */}
      <div className="hidden items-center justify-center bg-gradient-to-br from-teal-600 to-teal-700 p-12 text-white lg:flex lg:w-[40%]">
        <div className="max-w-sm">
          <div className="mb-6 flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={`star-${i + 1}`} className="h-5 w-5 fill-teal-300 text-teal-300" />
            ))}
          </div>
          <blockquote className="text-xl font-semibold leading-relaxed">
            &ldquo;I was able to get my dog the surgery she needed without worrying about the full
            cost upfront. FuzzyCat made it so easy.&rdquo;
          </blockquote>
          <div className="mt-6">
            <p className="font-medium">Jessica M.</p>
            <p className="text-sm text-teal-200">Pet owner, San Francisco</p>
          </div>
        </div>
      </div>

      {/* Right panel: signup form */}
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md space-y-6">
          {emailSent ? (
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
                We sent a confirmation link to <strong>{emailSent}</strong>. Click the link in the
                email to activate your account.
              </p>
              <button
                type="button"
                onClick={() => setEmailSent(null)}
                className="text-sm font-medium text-primary hover:text-primary/80"
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-3xl font-bold">Join the Fuzzycat Family</h1>
                <p className="mt-2 text-muted-foreground">
                  Create your account to start splitting vet bills
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    required
                    autoComplete="name"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    autoComplete="tel"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="petName">Pet Name</Label>
                  <Input id="petName" name="petName" type="text" required className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="mt-1.5"
                  />
                </div>

                <Captcha
                  onVerify={handleCaptchaVerify}
                  onError={handleCaptchaError}
                  className="my-2"
                />

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Creating account...' : 'Create Account'}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link
                  href="/login/owner"
                  className="font-medium text-primary hover:text-primary/80"
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
