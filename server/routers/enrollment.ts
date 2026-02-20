// ── Enrollment tRPC router ───────────────────────────────────────────
// Exposes enrollment service functions as typed procedures.

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { MIN_BILL_CENTS } from '@/lib/constants';
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
  addressLine1: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressZip: z.string().optional(),
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
          ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
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
    .query(async ({ input }) => {
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
      try {
        await cancelEnrollment(input.planId, ctx.session.userId, ctx.session.role);
        return { success: true as const };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to cancel enrollment';
        throw new TRPCError({ code: 'BAD_REQUEST', message });
      }
    }),
});
