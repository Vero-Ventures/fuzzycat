import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  getClinicEarnings,
  getClinicPayoutHistory,
  processClinicPayout,
} from '@/server/services/payout';
import { adminProcedure, clinicProcedure, router } from '@/server/trpc';

export const payoutRouter = router({
  /**
   * Process a payout for a specific payment.
   * Admin-only: triggered by the system after a successful payment,
   * or manually by an admin for recovery scenarios.
   */
  process: adminProcedure
    .input(z.object({ paymentId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      try {
        return await processClinicPayout(input.paymentId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Payout processing failed';
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message });
      }
    }),

  /**
   * Get paginated payout history for the authenticated clinic.
   */
  history: clinicProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      return getClinicPayoutHistory(ctx.clinicId, {
        limit: input.limit,
        offset: input.offset,
      });
    }),

  /**
   * Get aggregate earnings for the authenticated clinic.
   */
  earnings: clinicProcedure.query(async ({ ctx }) => {
    return getClinicEarnings(ctx.clinicId);
  }),
});
