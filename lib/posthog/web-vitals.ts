import type { Metric } from 'web-vitals';
import { POSTHOG_EVENTS } from './events';

/**
 * Report Core Web Vitals (LCP, INP, CLS, FCP, TTFB) to PostHog as custom events.
 *
 * Each metric is captured as a `web_vital_captured` event with structured properties,
 * making them queryable via PostHog's HogQL API.
 *
 * Call once on the client after PostHog is initialized (or initializing).
 * The web-vitals observers fire asynchronously — no main-thread blocking.
 */
export function reportWebVitals() {
  if (typeof window === 'undefined') return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  import('web-vitals').then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
    const handleMetric = (metric: Metric) => {
      import('posthog-js').then(({ default: posthog }) => {
        if (!posthog.__loaded) return;
        posthog.capture(POSTHOG_EVENTS.WEB_VITAL_CAPTURED, {
          metric_name: metric.name,
          metric_value: metric.value,
          metric_rating: metric.rating,
          metric_delta: metric.delta,
          metric_id: metric.id,
          navigation_type: metric.navigationType,
          page_url: window.location.href,
        });
      });
    };

    onCLS(handleMetric);
    onFCP(handleMetric);
    onINP(handleMetric);
    onLCP(handleMetric);
    onTTFB(handleMetric);
  });
}
