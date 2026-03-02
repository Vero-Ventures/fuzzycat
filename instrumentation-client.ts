import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Load replay and feedback integrations asynchronously via dynamic import
// to reduce initial bundle size. Using @sentry/browser npm imports instead
// of lazyLoadIntegration() (CDN-based) to avoid CSP eval violations.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  import('@sentry/browser').then(({ replayIntegration, feedbackIntegration }) => {
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
  });
}

export { captureRouterTransitionStart as onRouterTransitionStart } from '@sentry/nextjs';
