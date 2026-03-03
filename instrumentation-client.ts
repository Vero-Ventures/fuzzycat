import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Dynamically import integrations from the npm package (not CDN) for code splitting.
// This avoids the bundle-size hit of static imports and the CSP-blocked
// lazyLoadIntegration() which fetches scripts from sentry-cdn.com.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const loadIntegrations = () => {
    import('@sentry/browser')
      .then(({ replayIntegration, feedbackIntegration }) => {
        Sentry.addIntegration(replayIntegration());
        Sentry.addIntegration(
          feedbackIntegration({
            colorScheme: 'system',
            autoInject: true,
            enableScreenshot: true,
            showBranding: false,
            triggerLabel: 'Feedback',
            formTitle: 'Send us feedback',
            submitButtonLabel: 'Send feedback',
            messagePlaceholder: "What's on your mind? Bug reports, suggestions, anything.",
            isEmailRequired: false,
            isNameRequired: false,
          }),
        );
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
