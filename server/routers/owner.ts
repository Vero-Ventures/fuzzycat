import { publicProcedure, router } from '@/server/trpc';

export const ownerRouter = router({
  healthCheck: publicProcedure.query(() => {
    return { status: 'ok' as const, router: 'owner' };
  }),
});
