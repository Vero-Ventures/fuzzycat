import { protectedProcedure, router } from '@/server/trpc';

export const adminRouter = router({
  healthCheck: protectedProcedure.query(() => {
    return { status: 'ok' as const, router: 'admin' };
  }),
});
