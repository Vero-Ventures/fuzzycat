// ── Enrollment tRPC router ───────────────────────────────────────────
// Exposes enrollment service functions as typed procedures.

import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { MAX_BILL_CENTS, MIN_BILL_CENTS } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { calculatePaymentSchedule } from '@/lib/utils/schedule';
import { db } from '@/server/db';
import { clinics } from '@/server/db/schema';
import { assertClinicOwnership, assertPlanAccess } from '@/server/services/authorization';
import {
  type CreateEnrollmentResult,
  cancelEnrollment,
  createEnrollment,
  getEnrollmentSummary,
} from '@/server/services/enrollment';
import { provisionOwnerAccount } from '@/server/services/owner-provisioning';
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
      // Reject enrollments from New York state (pending DFS BNPL Act regulations)
      if (input.ownerData.addressState?.toUpperCase() === 'NY') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Payment plans are not currently available in New York state.',
        });
      }

      // Admin users bypass clinic ownership check
      if (ctx.session.role !== 'admin') {
        await assertClinicOwnership(ctx.session.userId, input.clinicId);
      }

      let result: CreateEnrollmentResult;
      try {
        result = await createEnrollment(
          input.clinicId,
          input.ownerData,
          input.billAmountCents,
          ctx.session.userId,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create enrollment';
        throw new TRPCError({ code: 'BAD_REQUEST', message });
      }

      // Provision owner account (non-blocking — enrollment is valid even if this fails)
      try {
        const [clinic] = await db
          .select({ name: clinics.name })
          .from(clinics)
          .where(eq(clinics.id, input.clinicId))
          .limit(1);

        await provisionOwnerAccount({
          ownerId: result.ownerId,
          ownerEmail: input.ownerData.email,
          ownerName: input.ownerData.name,
          petName: input.ownerData.petName,
          planId: result.planId,
          clinicName: clinic?.name ?? 'Your Veterinary Clinic',
          schedule: calculatePaymentSchedule(input.billAmountCents),
        });
      } catch (err) {
        logger.error('Owner provisioning failed (enrollment still valid)', {
          planId: result.planId,
          ownerId: result.ownerId,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      return result;
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
