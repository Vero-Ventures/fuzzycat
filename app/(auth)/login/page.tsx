import { Cat } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
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
    <div className="flex min-h-screen">
      {/* Left panel: branding with cat photo */}
      <div className="hidden items-center justify-center bg-gradient-to-br from-teal-600 to-teal-700 p-12 text-white lg:flex lg:w-[40%]">
        <div className="max-w-sm space-y-8">
          <Image
            src="/sharkie.webp"
            alt="A black cat lounging comfortably"
            width={320}
            height={280}
            className="rounded-xl shadow-lg"
            sizes="320px"
            priority
          />
          <div>
            <Cat className="mb-3 h-8 w-8 text-teal-200" />
            <blockquote className="text-2xl font-semibold leading-relaxed">
              &ldquo;Because your best friend deserves the best care.&rdquo;
            </blockquote>
            <p className="mt-4 text-teal-200">
              Flexible payment plans for veterinary care. No credit check. No interest.
            </p>
          </div>
        </div>
      </div>

      {/* Right panel: login form */}
      <div className="flex flex-1 items-center justify-center px-4 sm:px-8">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Welcome Back</h1>
            <p className="mt-2 text-muted-foreground">Sign in to your account</p>
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
    </div>
  );
}
