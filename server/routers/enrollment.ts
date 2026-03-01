// ── Enrollment tRPC router ───────────────────────────────────────────
// Exposes enrollment service functions as typed procedures.

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { MAX_BILL_CENTS, MIN_BILL_CENTS } from '@/lib/constants';
import { assertClinicOwnership, assertPlanAccess } from '@/server/services/authorization';
import {
  cancelEnrollment,
  createEnrollment,
  getEnrollmentSummary,
} from '@/server/services/enrollment';
import { clinicProcedure, protectedProcedure, router } from '@/server/trpc';

const ownerDataSchema = z.object({
  name: z.string().min(1, 'Owner name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(1, 'Phone number is required'),
  petName: z.string().min(1, 'Pet name is required'),
  paymentMethod: z.enum(['debit_card', 'bank_account']),
  addressLine1: z.string().max(200).optional(),
  addressCity: z.string().max(100).optional(),
  addressState: z.string().max(2).optional(),
  addressZip: z.string().max(10).optional(),
});

export const enrollmentRouter = router({
  /**
   * Create a new enrollment. Clinic staff initiates a payment plan for a pet owner.
   */
  create: clinicProcedure
    .input(
      z.object({
        clinicId: z.string().uuid('Valid clinic ID is required'),
        ownerData: ownerDataSchema,
        billAmountCents: z
          .number()
          .int()
          .min(
            MIN_BILL_CENTS,
            `Bill must be at least ${MIN_BILL_CENTS} cents ($${MIN_BILL_CENTS / 100})`,
          )
          .max(
            MAX_BILL_CENTS,
            `Bill must not exceed ${MAX_BILL_CENTS} cents ($${MAX_BILL_CENTS / 100})`,
          ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Admin users bypass clinic ownership check
      if (ctx.session.role !== 'admin') {
        await assertClinicOwnership(ctx.session.userId, input.clinicId);
      }

      try {
        return await createEnrollment(
          input.clinicId,
          input.ownerData,
          input.billAmountCents,
          ctx.session.userId,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create enrollment';
        throw new TRPCError({ code: 'BAD_REQUEST', message });
      }
    }),

  /**
   * Get a full enrollment summary for the review screen.
   */
  getSummary: protectedProcedure
    .input(z.object({ planId: z.string().uuid('Valid plan ID is required') }))
    .query(async ({ input, ctx }) => {
      // Verify the user has access to this plan (clinic, owner, or admin)
      await assertPlanAccess(ctx.session.userId, ctx.session.role, input.planId);

      try {
        return await getEnrollmentSummary(input.planId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get enrollment summary';
        throw new TRPCError({ code: 'NOT_FOUND', message });
      }
    }),

  /**
   * Cancel an enrollment before the deposit is paid.
   */
  cancel: protectedProcedure
    .input(z.object({ planId: z.string().uuid('Valid plan ID is required') }))
    .mutation(async ({ input, ctx }) => {
      // Verify the user has access to this plan (clinic, owner, or admin)
      await assertPlanAccess(ctx.session.userId, ctx.session.role, input.planId);

      try {
        await cancelEnrollment(input.planId, ctx.session.userId, ctx.session.role);
        return { success: true as const };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to cancel enrollment';
        throw new TRPCError({ code: 'BAD_REQUEST', message });
      }
    }),
});
