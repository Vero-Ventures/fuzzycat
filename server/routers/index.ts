import { publicProcedure, router } from '@/server/trpc';
import { adminRouter } from './admin';
import { clientRouter } from './client';
import { clinicRouter } from './clinic';
import { enrollmentRouter } from './enrollment';
import { growthRouter } from './growth';
import { paymentRouter } from './payment';
import { payoutRouter } from './payout';
import { planRouter } from './plan';

export const appRouter = router({
  health: publicProcedure.query(() => {
    return { status: 'ok' as const, timestamp: new Date() };
  }),
  clinic: clinicRouter,
  enrollment: enrollmentRouter,
  growth: growthRouter,
  client: clientRouter,
  plan: planRouter,
  payment: paymentRouter,
  payout: payoutRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
