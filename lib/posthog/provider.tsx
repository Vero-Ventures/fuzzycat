'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

/** Captures page views on client-side navigation (App Router). */
function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    import('posthog-js').then(({ default: posthog }) => {
      if (!posthog.__loaded) return;
      let url = window.origin + pathname;
      if (searchParams.toString()) {
        url = `${url}?${searchParams.toString()}`;
      }
      posthog.capture('$pageview', { $current_url: url });
    });
  }, [pathname, searchParams]);

  return null;
}

/**
 * Schedule a callback for when the browser is idle.
 * Falls back to a 1s setTimeout on browsers without requestIdleCallback (Safari).
 */
function whenIdle(callback: () => void) {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(callback);
  } else {
    setTimeout(callback, 1000);
  }
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    whenIdle(() => {
      import('posthog-js').then(({ default: posthog }) => {
        if (posthog.__loaded) return;
        posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
          capture_pageview: false,
          person_profiles: 'identified_only',
        });
      });
    });
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </>
  );
}
