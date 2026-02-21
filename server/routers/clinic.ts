import { TRPCError } from '@trpc/server';
import { and, eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { stripe } from '@/lib/stripe';
import { clinics } from '@/server/db/schema';
import { logAuditEvent } from '@/server/services/audit';
import { sendClinicWelcome } from '@/server/services/email';
import { createConnectAccount, createOnboardingLink } from '@/server/services/stripe/connect';
import { clinicProcedure, protectedProcedure, router } from '@/server/trpc';

// ── Helpers ──────────────────────────────────────────────────────────

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

/**
 * Look up the clinic record for the authenticated user.
 * Throws NOT_FOUND if no clinic is linked to this auth user.
 */
async function getClinicForUser(
  db: Parameters<typeof clinicProcedure.query>[0] extends (opts: infer O) => unknown
    ? O extends { ctx: infer C }
      ? C extends { db: infer D }
        ? D
        : never
      : never
    : never,
  userId: string,
) {
  const [clinic] = await db
    .select({
      id: clinics.id,
      name: clinics.name,
      email: clinics.email,
      phone: clinics.phone,
      addressLine1: clinics.addressLine1,
      addressCity: clinics.addressCity,
      addressState: clinics.addressState,
      addressZip: clinics.addressZip,
      stripeAccountId: clinics.stripeAccountId,
      status: clinics.status,
    })
    .from(clinics)
    .where(eq(clinics.authId, userId))
    .limit(1);

  if (!clinic) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Clinic profile not found' });
  }

  return clinic;
}

// ── Router ───────────────────────────────────────────────────────────

export const clinicRouter = router({
  healthCheck: clinicProcedure.query(() => {
    return { status: 'ok' as const, router: 'clinic' };
  }),

  /**
   * Search clinics by name or city. Only returns active clinics.
   * Available to any authenticated user (pet owners need this during enrollment).
   */
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
      }),
    )
    .query(async ({ input, ctx }) => {
      const searchPattern = `%${input.query}%`;
      const results = await ctx.db
        .select({
          id: clinics.id,
          name: clinics.name,
          addressCity: clinics.addressCity,
          addressState: clinics.addressState,
        })
        .from(clinics)
        .where(
          and(
            eq(clinics.status, 'active'),
            or(ilike(clinics.name, searchPattern), ilike(clinics.addressCity, searchPattern)),
          ),
        )
        .limit(10);

      return results;
    }),

  /**
   * Get the authenticated clinic's profile information.
   */
  getProfile: clinicProcedure.query(async ({ ctx }) => {
    return getClinicForUser(ctx.db, ctx.session.userId);
  }),

  /**
   * Update the authenticated clinic's profile (name, phone, address fields).
   */
  updateProfile: clinicProcedure
    .input(
      z.object({
        name: z.string().min(1, 'Clinic name is required').optional(),
        phone: z
          .string()
          .regex(/^\+[1-9]\d{1,14}$/, 'Phone must be in E.164 format (e.g., +15551234567)')
          .optional(),
        addressLine1: z.string().min(1).optional(),
        addressCity: z.string().min(1).optional(),
        addressState: z.string().length(2, 'State must be a 2-letter code').optional(),
        addressZip: z.string().min(5, 'ZIP code is required').optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const clinic = await getClinicForUser(ctx.db, ctx.session.userId);

      const updateData: Record<string, string> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (input.addressLine1 !== undefined) updateData.addressLine1 = input.addressLine1;
      if (input.addressCity !== undefined) updateData.addressCity = input.addressCity;
      if (input.addressState !== undefined)
        updateData.addressState = input.addressState.toUpperCase();
      if (input.addressZip !== undefined) updateData.addressZip = input.addressZip;

      if (Object.keys(updateData).length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No fields to update' });
      }

      const [updated] = await ctx.db
        .update(clinics)
        .set(updateData)
        .where(eq(clinics.id, clinic.id))
        .returning({
          id: clinics.id,
          name: clinics.name,
          email: clinics.email,
          phone: clinics.phone,
          addressLine1: clinics.addressLine1,
          addressCity: clinics.addressCity,
          addressState: clinics.addressState,
          addressZip: clinics.addressZip,
          stripeAccountId: clinics.stripeAccountId,
          status: clinics.status,
        });

      return updated;
    }),

  /**
   * Start Stripe Connect onboarding for the authenticated clinic.
   * Creates a Connect account if one doesn't exist, then generates an
   * onboarding link that redirects the user to Stripe's hosted onboarding.
   */
  startStripeOnboarding: clinicProcedure.mutation(async ({ ctx }) => {
    const clinic = await getClinicForUser(ctx.db, ctx.session.userId);
    const appUrl = getAppUrl();

    let stripeAccountId = clinic.stripeAccountId;

    // Create a Stripe Connect account if the clinic doesn't have one yet
    if (!stripeAccountId) {
      try {
        const result = await createConnectAccount({
          clinicId: clinic.id,
          email: clinic.email,
          businessName: clinic.name,
        });
        stripeAccountId = result.accountId;
      } catch (error) {
        logger.error('Failed to create Stripe Connect account', {
          clinicId: clinic.id,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create payment account. Please try again.',
        });
      }
    }

    // Generate a Stripe onboarding link
    try {
      const { url } = await createOnboardingLink({
        stripeAccountId,
        returnUrl: `${appUrl}/clinic/onboarding/stripe-return`,
        refreshUrl: `${appUrl}/clinic/onboarding`,
      });

      return { url };
    } catch (error) {
      logger.error('Failed to create Stripe onboarding link', {
        clinicId: clinic.id,
        stripeAccountId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to generate onboarding link. Please try again.',
      });
    }
  }),

  /**
   * Get the onboarding status for the authenticated clinic.
   * Checks Stripe account status, profile completeness, and MFA enrollment.
   */
  getOnboardingStatus: clinicProcedure.query(async ({ ctx }) => {
    const clinic = await getClinicForUser(ctx.db, ctx.session.userId);

    // Check profile completeness
    const profileComplete = Boolean(
      clinic.name &&
        clinic.phone &&
        clinic.email &&
        clinic.addressLine1 &&
        clinic.addressCity &&
        clinic.addressState &&
        clinic.addressZip,
    );

    // Check Stripe Connect status
    let stripeStatus: 'not_started' | 'pending' | 'active' = 'not_started';
    let stripeChargesEnabled = false;
    let stripePayoutsEnabled = false;

    if (clinic.stripeAccountId) {
      try {
        const account = await stripe().accounts.retrieve(clinic.stripeAccountId);
        stripeChargesEnabled = account.charges_enabled ?? false;
        stripePayoutsEnabled = account.payouts_enabled ?? false;

        if (stripeChargesEnabled && stripePayoutsEnabled) {
          stripeStatus = 'active';
        } else {
          stripeStatus = 'pending';
        }
      } catch (error) {
        logger.error('Failed to retrieve Stripe account status', {
          clinicId: clinic.id,
          stripeAccountId: clinic.stripeAccountId,
          error: error instanceof Error ? error.message : String(error),
        });
        // If we can't reach Stripe, report as pending since account exists
        stripeStatus = 'pending';
      }
    }

    // Check MFA status from Supabase
    const { data: mfaFactors } = await ctx.supabase.auth.mfa.listFactors();
    const mfaEnabled = mfaFactors?.totp?.some((f) => f.status === 'verified') ?? false;

    return {
      clinicId: clinic.id,
      clinicName: clinic.name,
      clinicStatus: clinic.status,
      profileComplete,
      stripe: {
        status: stripeStatus,
        chargesEnabled: stripeChargesEnabled,
        payoutsEnabled: stripePayoutsEnabled,
        accountId: clinic.stripeAccountId,
      },
      mfaEnabled,
      allComplete: profileComplete && stripeStatus === 'active' && mfaEnabled,
    };
  }),

  /**
   * Mark clinic as active after all onboarding steps are complete.
   * Requires: profile complete, Stripe Connect active, MFA enabled.
   * Sends a welcome email on successful activation.
   */
  completeOnboarding: clinicProcedure.mutation(async ({ ctx }) => {
    const clinic = await getClinicForUser(ctx.db, ctx.session.userId);

    // Don't allow completing onboarding if already active
    if (clinic.status === 'active') {
      return { status: 'active' as const, alreadyActive: true };
    }

    // Verify profile completeness
    const profileComplete = Boolean(
      clinic.name &&
        clinic.phone &&
        clinic.email &&
        clinic.addressLine1 &&
        clinic.addressCity &&
        clinic.addressState &&
        clinic.addressZip,
    );

    if (!profileComplete) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Please complete your clinic profile before finishing onboarding.',
      });
    }

    // Verify Stripe Connect is active
    if (!clinic.stripeAccountId) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Please connect your Stripe account before finishing onboarding.',
      });
    }

    let stripeReady = false;
    try {
      const account = await stripe().accounts.retrieve(clinic.stripeAccountId);
      stripeReady = (account.charges_enabled && account.payouts_enabled) ?? false;
    } catch (error) {
      logger.error('Failed to verify Stripe account during onboarding completion', {
        clinicId: clinic.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Unable to verify payment account status. Please try again.',
      });
    }

    if (!stripeReady) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'Your Stripe account is still being verified. Please complete Stripe onboarding first.',
      });
    }

    // Verify MFA is enabled
    const { data: mfaFactors } = await ctx.supabase.auth.mfa.listFactors();
    const mfaEnabled = mfaFactors?.totp?.some((f) => f.status === 'verified') ?? false;

    if (!mfaEnabled) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Please enable multi-factor authentication before finishing onboarding.',
      });
    }

    // All checks pass - activate the clinic
    await ctx.db.update(clinics).set({ status: 'active' }).where(eq(clinics.id, clinic.id));

    // Audit log the status change
    await logAuditEvent({
      entityType: 'clinic',
      entityId: clinic.id,
      action: 'status_changed',
      oldValue: { status: clinic.status },
      newValue: { status: 'active' },
      actorType: 'clinic',
      actorId: ctx.session.userId,
    });

    // Send welcome email (non-blocking)
    const appUrl = getAppUrl();
    try {
      await sendClinicWelcome(clinic.email, {
        clinicName: clinic.name,
        contactName: clinic.name,
        dashboardUrl: `${appUrl}/clinic/dashboard`,
        connectUrl: `${appUrl}/clinic/onboarding`,
      });
    } catch (error) {
      // Email failure should not block onboarding completion
      logger.error('Failed to send clinic welcome email', {
        clinicId: clinic.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return { status: 'active' as const, alreadyActive: false };
  }),
});
