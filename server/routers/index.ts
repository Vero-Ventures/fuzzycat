import { publicProcedure, router } from '@/server/trpc';
import { adminRouter } from './admin';
import { clinicRouter } from './clinic';
import { enrollmentRouter } from './enrollment';
import { ownerRouter } from './owner';
import { paymentRouter } from './payment';
import { payoutRouter } from './payout';
import { plaidRouter } from './plaid';
import { planRouter } from './plan';

export const appRouter = router({
  health: publicProcedure.query(() => {
    return { status: 'ok' as const, timestamp: new Date() };
  }),
  clinic: clinicRouter,
  enrollment: enrollmentRouter,
  owner: ownerRouter,
  plan: planRouter,
  payment: paymentRouter,
  payout: payoutRouter,
  plaid: plaidRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
