/** Initialize PostHog on the client. No-ops if NEXT_PUBLIC_POSTHOG_KEY is not set. */
export async function initPostHog() {
  if (typeof window === 'undefined') return null;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return null;

  const { default: posthog } = await import('posthog-js');
  if (posthog.__loaded) return posthog;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    capture_pageview: false, // handled by PostHogPageView component
    capture_pageleave: false,
    person_profiles: 'identified_only',
    disable_external_dependency_loading: true,
  });

  return posthog;
}
