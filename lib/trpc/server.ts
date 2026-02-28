import { dehydrate } from '@tanstack/react-query';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import { cache } from 'react';
import { getAuthFromMiddleware } from '@/lib/auth-from-middleware';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/server/db';
import { type AppRouter, appRouter } from '@/server/routers';
import { makeQueryClient } from './query-client';

/**
 * Creates a server-side tRPC options proxy for React Query prefetching.
 *
 * Returns a proxy with the same `.queryOptions()` API as the client-side
 * `useTRPC()` hook, but executes procedures directly via the router
 * (no HTTP round-trip). Query keys automatically match the client-side
 * keys, so `HydrationBoundary` + `dehydrate()` seamlessly hydrates
 * the React Query cache on the client.
 *
 * Uses `getAuthFromMiddleware()` for zero-cost auth (reads middleware-injected
 * headers instead of calling Supabase `getUser()`). Wrapped in React `cache()`
 * to deduplicate within a single server render pass.
 *
 * Usage in server components:
 * ```ts
 * const { trpc, queryClient, dehydrate } = await createServerHelpers();
 * await queryClient.prefetchQuery(trpc.clinic.getDashboardStats.queryOptions());
 * // In JSX: <HydrationBoundary state={dehydrate()}>
 * ```
 */
export const createServerHelpers = cache(async () => {
  const auth = await getAuthFromMiddleware();
  const supabase = await createClient();
  const queryClient = makeQueryClient();

  const trpc = createTRPCOptionsProxy<AppRouter>({
    router: appRouter,
    ctx: {
      db,
      supabase,
      session: auth,
      requestId: undefined,
      req: new Request('https://localhost'),
      resHeaders: new Headers(),
    },
    queryClient,
  });

  return {
    trpc,
    queryClient,
    dehydrate: () => dehydrate(queryClient),
  };
});
