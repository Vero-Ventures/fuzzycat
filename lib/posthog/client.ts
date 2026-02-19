import posthog from 'posthog-js';

/** Initialize PostHog on the client. No-ops if NEXT_PUBLIC_POSTHOG_KEY is not set. */
export function initPostHog() {
  if (typeof window === 'undefined') return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  if (posthog.__loaded) return;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    capture_pageview: false, // handled by PostHogPageView component
    person_profiles: 'identified_only',
  });
}

export { posthog };
