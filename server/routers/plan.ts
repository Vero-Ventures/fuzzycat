import { protectedProcedure, router } from '@/server/trpc';

export const planRouter = router({
  healthCheck: protectedProcedure.query(() => {
    return { status: 'ok' as const, router: 'plan' };
  }),
});
