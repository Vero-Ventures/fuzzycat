import { ownerProcedure, router } from '@/server/trpc';

export const ownerRouter = router({
  healthCheck: ownerProcedure.query(() => {
    return { status: 'ok' as const, router: 'owner' };
  }),
});
