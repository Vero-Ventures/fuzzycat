import { LoginForm } from './login-form';

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
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your email and password to continue
          </p>
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
          <a href="/signup" className="font-medium text-primary hover:text-primary/80">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
