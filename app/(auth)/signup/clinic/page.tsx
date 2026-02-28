'use client';

import { BadgeCheck, HandCoins, Shield } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { signUpClinic } from '@/app/(auth)/signup/actions';
import { Captcha } from '@/components/shared/captcha';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ClinicSignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleCaptchaVerify = useCallback((token: string) => {
    setCaptchaToken(token);
  }, []);

  const handleCaptchaError = useCallback(() => {
    setCaptchaToken(null);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!termsAccepted) {
      setError('Please accept the terms and conditions.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      if (captchaToken) {
        formData.set('captchaToken', captchaToken);
      }
      const result = await signUpClinic(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      router.push('/clinic/dashboard');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel: form */}
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8 lg:w-[55%]">
        <div className="w-full max-w-lg space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Register Your Clinic</h1>
            <p className="mt-2 text-muted-foreground">
              Start offering flexible payment plans to your clients
            </p>
          </div>

          {error && (
            <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="clinicName" className="uppercase text-xs font-semibold tracking-wide">
                Clinic Name
              </Label>
              <Input id="clinicName" name="clinicName" type="text" required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="email" className="uppercase text-xs font-semibold tracking-wide">
                Email
              </Label>
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
              <Label htmlFor="phone" className="uppercase text-xs font-semibold tracking-wide">
                Phone
              </Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                className="mt-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label
                  htmlFor="addressState"
                  className="uppercase text-xs font-semibold tracking-wide"
                >
                  State
                </Label>
                <Input
                  id="addressState"
                  name="addressState"
                  type="text"
                  required
                  maxLength={2}
                  placeholder="CA"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label
                  htmlFor="addressZip"
                  className="uppercase text-xs font-semibold tracking-wide"
                >
                  ZIP Code
                </Label>
                <Input
                  id="addressZip"
                  name="addressZip"
                  type="text"
                  required
                  maxLength={10}
                  placeholder="94105"
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="password" className="uppercase text-xs font-semibold tracking-wide">
                Password
              </Label>
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
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 rounded border-input"
              />
              <span className="text-muted-foreground">
                I agree to the{' '}
                <Link href="/terms" className="font-medium text-primary hover:text-primary/80">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="font-medium text-primary hover:text-primary/80">
                  Privacy Policy
                </Link>
              </span>
            </label>

            <Captcha onVerify={handleCaptchaVerify} onError={handleCaptchaError} className="my-2" />

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Registering...' : 'Register Clinic'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login/clinic" className="font-medium text-primary hover:text-primary/80">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right panel: value props */}
      <div className="hidden items-center justify-center bg-gradient-to-br from-teal-50 to-teal-100 p-12 dark:from-teal-950/30 dark:to-teal-900/20 lg:flex lg:w-[45%]">
        <div className="max-w-sm space-y-8">
          <h2 className="text-2xl font-bold">Why Offer Fuzzycat?</h2>
          <div className="space-y-6">
            <FeatureCard
              icon={<HandCoins className="h-5 w-5" />}
              title="Earn 3% revenue share"
              description="The only payment plan that pays clinics instead of charging them."
            />
            <FeatureCard
              icon={<Shield className="h-5 w-5" />}
              title="Reduce default risk"
              description="25% deposit upfront and automated collection protects your revenue."
            />
            <FeatureCard
              icon={<BadgeCheck className="h-5 w-5" />}
              title="Zero setup cost"
              description="No hardware, no contracts, no merchant fees. Start in minutes."
            />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm italic text-muted-foreground">
              &ldquo;FuzzyCat has increased our treatment acceptance rate by 35%. Clients love
              having the option to split their bill.&rdquo;
            </p>
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              — Dr. Sarah Chen, Bay Area Veterinary
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
