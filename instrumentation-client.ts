import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Lazy-load replay and feedback integrations to reduce initial bundle size.
// Deferred to requestIdleCallback so the main thread stays free during
// page load and first interactions, improving INP on mobile by avoiding
// ~400ms of CDN fetch + integration init during the interaction window.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const loadIntegrations = () => {
    Sentry.lazyLoadIntegration('replayIntegration').then((replayIntegration) => {
      Sentry.addIntegration(replayIntegration());
    });

    Sentry.lazyLoadIntegration('feedbackIntegration').then((feedbackIntegration) => {
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
    });
  };

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(loadIntegrations);
  } else {
    setTimeout(loadIntegrations, 1000);
  }
}

export { captureRouterTransitionStart as onRouterTransitionStart } from '@sentry/nextjs';
