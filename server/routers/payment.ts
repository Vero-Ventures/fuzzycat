import { publicProcedure, router } from '@/server/trpc';

export const paymentRouter = router({
  healthCheck: publicProcedure.query(() => {
    return { status: 'ok' as const, router: 'payment' };
  }),
});
