import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');

    // Validate environment variables at cold start so misconfigs surface
    // immediately in Vercel deploy logs. We log but don't throw — the app
    // starts in a degraded state so /api/health can report the failure.
    const { publicEnv, serverEnv } = await import('./lib/env');
    try {
      publicEnv();
    } catch (error) {
      console.error(
        '[instrumentation] publicEnv validation failed:',
        error instanceof Error ? error.message : error,
      );
    }
    try {
      serverEnv();
    } catch (error) {
      console.error(
        '[instrumentation] serverEnv validation failed:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
