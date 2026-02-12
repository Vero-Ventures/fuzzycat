import { publicProcedure, router } from '@/server/trpc';

export const planRouter = router({
  healthCheck: publicProcedure.query(() => {
    return { status: 'ok' as const, router: 'plan' };
  }),
});
