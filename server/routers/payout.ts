import { publicProcedure, router } from '@/server/trpc';

export const payoutRouter = router({
  healthCheck: publicProcedure.query(() => {
    return { status: 'ok' as const, router: 'payout' };
  }),
});
