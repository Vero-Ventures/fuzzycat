import { z } from 'zod';
import {
  escalateDefault,
  identifyDuePayments,
  identifyPlansForEscalation,
  retryFailedPayment,
} from '@/server/services/collection';
import { processDeposit, processInstallment } from '@/server/services/payment';
import { adminProcedure, ownerProcedure, router } from '@/server/trpc';

export const paymentRouter = router({
  /**
   * Initiate a deposit checkout session for a plan.
   * Called by the pet owner during enrollment.
   */
  initiateDeposit: ownerProcedure
    .input(
      z.object({
        planId: z.string().uuid(),
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await processDeposit({
        planId: input.planId,
        ownerId: ctx.ownerId,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
      });
      return result;
    }),

  /**
   * Initiate an installment payment via ACH.
   * Can be called manually by admin or triggered by the collection cron.
   */
  processInstallment: adminProcedure
    .input(
      z.object({
        paymentId: z.string().uuid(),
        paymentMethodId: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await processInstallment({
        paymentId: input.paymentId,
        paymentMethodId: input.paymentMethodId,
      });
      return result;
    }),

  /**
   * Retry a failed payment. Admin-only.
   */
  retryPayment: adminProcedure
    .input(z.object({ paymentId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const success = await retryFailedPayment(input.paymentId);
      return { success };
    }),

  /**
   * Get all payments that are due for collection.
   * Admin-only endpoint used by the collection dashboard or cron.
   */
  getDuePayments: adminProcedure.query(async () => {
    const duePayments = await identifyDuePayments();
    return { payments: duePayments };
  }),

  /**
   * Escalate a plan to defaulted status. Admin-only.
   */
  escalateToDefault: adminProcedure
    .input(z.object({ planId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await escalateDefault(input.planId);
      return { success: true };
    }),

  /**
   * Get plans that should be escalated to default.
   * Admin-only endpoint used by the collection dashboard.
   */
  getPlansForEscalation: adminProcedure.query(async () => {
    const planIds = await identifyPlansForEscalation();
    return { planIds };
  }),
});
