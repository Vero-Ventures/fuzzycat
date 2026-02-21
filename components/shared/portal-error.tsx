'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

interface PortalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  portalName: string;
}

export function PortalError({ error, reset, portalName }: PortalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { portal: portalName } });
  }, [error, portalName]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <h2 className="mb-2 text-2xl font-semibold">Something went wrong</h2>
      <p className="mb-6 text-muted-foreground">
        An unexpected error occurred. Our team has been notified.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Go home
        </a>
      </div>
    </div>
  );
}
