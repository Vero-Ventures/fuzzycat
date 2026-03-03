import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Lazy-load the replay integration to reduce initial bundle size.
// Deferred to requestIdleCallback so the main thread stays free during
// page load, improving INP on mobile.
//
// NOTE: feedbackIntegration was removed because lazyLoadIntegration
// fetches from sentry-cdn.com and the feedback script uses eval()
// internally, which our CSP blocks. Can be re-added when Sentry
// ships a CSP-compatible version.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const loadIntegrations = () => {
    Sentry.lazyLoadIntegration('replayIntegration')
      .then((replayIntegration) => {
        Sentry.addIntegration(replayIntegration());
      })
      .catch(() => {});
  };

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(loadIntegrations);
  } else {
    setTimeout(loadIntegrations, 1000);
  }
}

export { captureRouterTransitionStart as onRouterTransitionStart } from '@sentry/nextjs';
