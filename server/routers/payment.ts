import { protectedProcedure, router } from '@/server/trpc';

export const paymentRouter = router({
  healthCheck: protectedProcedure.query(() => {
    return { status: 'ok' as const, router: 'payment' };
  }),
});
