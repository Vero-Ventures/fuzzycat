import { clinicProcedure, router } from '@/server/trpc';

export const payoutRouter = router({
  healthCheck: clinicProcedure.query(() => {
    return { status: 'ok' as const, router: 'payout' };
  }),
});
