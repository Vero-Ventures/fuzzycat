'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { useState } from 'react';
import superjson from 'superjson';
import { SentryUserSync } from '@/components/sentry-user-sync';
import { PostHogProvider } from '@/lib/posthog/provider';
import type { AppRouter } from '@/server/routers';
import { TRPCProvider } from './client';
import { getQueryClient } from './query-client';

function getBaseUrl() {
  if (typeof window !== 'undefined') return '';
  // NEXT_PUBLIC_ vars are inlined at build time, so direct access is safe here.
  // On the server side during SSR, use the env var or fall back to localhost for dev.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl && process.env.NODE_ENV === 'production') {
    console.error(
      '[trpc] NEXT_PUBLIC_APP_URL is not set — SSR tRPC calls will use localhost fallback',
    );
  }
  return appUrl ?? 'http://localhost:3000';
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <PostHogProvider>
      <QueryClientProvider client={queryClient}>
        <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
          {children}
          <SentryUserSync />
          <SpeedInsights />
        </TRPCProvider>
      </QueryClientProvider>
    </PostHogProvider>
  );
}
