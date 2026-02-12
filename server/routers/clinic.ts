import { clinicProcedure, router } from '@/server/trpc';

export const clinicRouter = router({
  healthCheck: clinicProcedure.query(() => {
    return { status: 'ok' as const, router: 'clinic' };
  }),
});
