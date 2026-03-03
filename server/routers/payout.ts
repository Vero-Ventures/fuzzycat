import { z } from 'zod';
import { getClinicEarnings, getClinicPayoutHistory } from '@/server/services/payout';
import { clinicProcedure, router } from '@/server/trpc';

export const payoutRouter = router({
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
