import { publicProcedure, router } from '@/server/trpc';

export const clinicRouter = router({
  healthCheck: publicProcedure.query(() => {
    return { status: 'ok' as const, router: 'clinic' };
  }),
});
