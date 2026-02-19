import { PostHog } from 'posthog-node';

let _client: PostHog | null = null;

/** Server-side PostHog client singleton. Returns null if not configured. */
export function getPostHogServer(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return null;

  if (!_client) {
    _client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      // Serverless: flush immediately per request
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return _client;
}
