import { adminProcedure, router } from '@/server/trpc';

export const adminRouter = router({
  healthCheck: adminProcedure.query(() => {
    return { status: 'ok' as const, router: 'admin' };
  }),
});
