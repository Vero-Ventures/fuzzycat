import * as Sentry from '@sentry/nextjs';
import { feedbackIntegration } from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: process.env.NEXT_PUBLIC_SENTRY_DSN
    ? [
        feedbackIntegration({
          colorScheme: 'system',
          autoInject: true,
        }),
      ]
    : [],
});

// Lazy-load the replay integration to reduce initial bundle size.
// Deferred to requestIdleCallback so the main thread stays free during
// page load, improving INP on mobile.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const loadReplay = () => {
    Sentry.lazyLoadIntegration('replayIntegration')
      .then((replayIntegration) => {
        Sentry.addIntegration(replayIntegration());
      })
      .catch(() => {});
  };

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(loadReplay);
  } else {
    setTimeout(loadReplay, 1000);
  }
}

export { captureRouterTransitionStart as onRouterTransitionStart } from '@sentry/nextjs';
