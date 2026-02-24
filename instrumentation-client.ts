import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration(),
    Sentry.feedbackIntegration({
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
  ],
});

export { captureRouterTransitionStart as onRouterTransitionStart } from '@sentry/nextjs';
