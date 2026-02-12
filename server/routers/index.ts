import { publicProcedure, router } from '@/server/trpc';
import { adminRouter } from './admin';
import { clinicRouter } from './clinic';
import { ownerRouter } from './owner';
import { paymentRouter } from './payment';
import { payoutRouter } from './payout';
import { planRouter } from './plan';

export const appRouter = router({
  health: publicProcedure.query(() => {
    return { status: 'ok' as const, timestamp: new Date() };
  }),
  clinic: clinicRouter,
  owner: ownerRouter,
  plan: planRouter,
  payment: paymentRouter,
  payout: payoutRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
