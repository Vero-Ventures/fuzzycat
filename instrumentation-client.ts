import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Lazy-load replay and feedback integrations to reduce initial bundle size.
// Replay (~50kB) and feedback (~20kB) are loaded asynchronously after init,
// which keeps the critical JS bundle well under budget. Both integrations
// are low-priority for initial page load — replay only samples 10% of
// sessions and feedback is rarely interacted with.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
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
}

export { captureRouterTransitionStart as onRouterTransitionStart } from '@sentry/nextjs';
