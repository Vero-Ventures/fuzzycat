import { dehydrate } from '@tanstack/react-query';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import { headers } from 'next/headers';
import { cache } from 'react';
import { type AppRouter, appRouter } from '@/server/routers';
import { createTRPCContext } from '@/server/trpc';
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
 * Reuses `createTRPCContext` from the server, forwarding the current
 * request headers so middleware-injected auth (x-user-id, x-user-role)
 * is picked up without a redundant `getUser()` call.
 *
 * Wrapped in React `cache()` to deduplicate within a single server
 * render pass — multiple calls in the same request reuse the same instance.
 *
 * Usage in server components:
 * ```ts
 * const { trpc, queryClient, dehydrate } = await createServerHelpers();
 * await queryClient.prefetchQuery(trpc.clinic.getDashboardStats.queryOptions());
 * // In JSX: <HydrationBoundary state={dehydrate()}>
 * ```
 */
export const createServerHelpers = cache(async () => {
  const queryClient = makeQueryClient();
  const reqHeaders = await headers();
  const req = new Request('https://localhost', { headers: reqHeaders });
  const ctx = await createTRPCContext({ req, resHeaders: new Headers() });

  const trpc = createTRPCOptionsProxy<AppRouter>({
    router: appRouter,
    ctx,
    queryClient,
  });

  return {
    trpc,
    queryClient,
    dehydrate: () => dehydrate(queryClient),
  };
});
