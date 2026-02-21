import { TRPCError } from '@trpc/server';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { publicEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { stripe } from '@/lib/stripe';
import { clinics, owners, payments, payouts, plans } from '@/server/db/schema';
import { logAuditEvent } from '@/server/services/audit';
import { sendClinicWelcome } from '@/server/services/email';
import { createConnectAccount, createOnboardingLink } from '@/server/services/stripe/connect';
import { clinicProcedure, protectedProcedure, router } from '@/server/trpc';

// ── Helpers ──────────────────────────────────────────────────────────

function getAppUrl(): string {
  const url = publicEnv().NEXT_PUBLIC_APP_URL;
  if (!url && process.env.NODE_ENV === 'production') {
    logger.error(
      'NEXT_PUBLIC_APP_URL is not set — Stripe Connect URLs will use localhost fallback',
    );
  }
  return url ?? 'http://localhost:3000';
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

/** Resolve the clinic row ID for the authenticated user. */
async function resolveClinicId(
  db: typeof import('@/server/db')['db'],
  userId: string,
): Promise<string> {
  const [clinic] = await db
    .select({ id: clinics.id })
    .from(clinics)
    .where(eq(clinics.authId, userId))
    .limit(1);

  if (!clinic) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Clinic profile not found' });
  }
  return clinic.id;
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

  // ── Onboarding procedures (Issue #26) ────────────────────────────

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

  // ── Dashboard procedures (Issue #27) ─────────────────────────────

  /**
   * Get dashboard statistics for the authenticated clinic.
   * Returns: active plans count, total revenue earned (3% share),
   * pending payouts, and recent enrollments.
   */
  getDashboardStats: clinicProcedure.query(async ({ ctx }) => {
    const clinicId = await resolveClinicId(ctx.db, ctx.session.userId);

    // Run all queries in parallel for performance
    const [planCounts, earningsResult, pendingPayoutsResult, recentEnrollments] = await Promise.all(
      [
        // Plan counts by status
        ctx.db
          .select({
            activePlans: sql<number>`count(*) filter (where ${plans.status} in ('active', 'deposit_paid'))`,
            completedPlans: sql<number>`count(*) filter (where ${plans.status} = 'completed')`,
            defaultedPlans: sql<number>`count(*) filter (where ${plans.status} = 'defaulted')`,
            totalPlans: sql<number>`count(*)`,
          })
          .from(plans)
          .where(eq(plans.clinicId, clinicId)),

        // Total revenue earned (3% clinic share from succeeded payouts)
        ctx.db
          .select({
            totalRevenueCents: sql<number>`coalesce(sum(${payouts.clinicShareCents}), 0)`,
            totalPayoutCents: sql<number>`coalesce(sum(${payouts.amountCents}), 0)`,
          })
          .from(payouts)
          .where(and(eq(payouts.clinicId, clinicId), eq(payouts.status, 'succeeded'))),

        // Pending payouts count and amount
        ctx.db
          .select({
            pendingCount: sql<number>`count(*)`,
            pendingAmountCents: sql<number>`coalesce(sum(${payouts.amountCents}), 0)`,
          })
          .from(payouts)
          .where(and(eq(payouts.clinicId, clinicId), eq(payouts.status, 'pending'))),

        // Last 10 recent enrollments with owner info
        ctx.db
          .select({
            id: plans.id,
            ownerName: owners.name,
            petName: owners.petName,
            totalBillCents: plans.totalBillCents,
            status: plans.status,
            createdAt: plans.createdAt,
          })
          .from(plans)
          .leftJoin(owners, eq(plans.ownerId, owners.id))
          .where(eq(plans.clinicId, clinicId))
          .orderBy(desc(plans.createdAt))
          .limit(10),
      ],
    );

    return {
      activePlans: Number(planCounts[0]?.activePlans ?? 0),
      completedPlans: Number(planCounts[0]?.completedPlans ?? 0),
      defaultedPlans: Number(planCounts[0]?.defaultedPlans ?? 0),
      totalPlans: Number(planCounts[0]?.totalPlans ?? 0),
      totalRevenueCents: Number(earningsResult[0]?.totalRevenueCents ?? 0),
      totalPayoutCents: Number(earningsResult[0]?.totalPayoutCents ?? 0),
      pendingPayoutsCount: Number(pendingPayoutsResult[0]?.pendingCount ?? 0),
      pendingPayoutsCents: Number(pendingPayoutsResult[0]?.pendingAmountCents ?? 0),
      recentEnrollments,
    };
  }),

  /**
   * Get paginated list of pet owners (clients) with plans at this clinic.
   * Supports search by owner name or pet name, and filter by plan status.
   */
  getClients: clinicProcedure
    .input(
      z.object({
        search: z.string().max(100).optional(),
        status: z
          .enum(['pending', 'deposit_paid', 'active', 'completed', 'defaulted', 'cancelled'])
          .optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const clinicId = await resolveClinicId(ctx.db, ctx.session.userId);

      const offset = (input.page - 1) * input.pageSize;

      // Build where conditions
      const conditions = [eq(plans.clinicId, clinicId)];

      if (input.status) {
        conditions.push(eq(plans.status, input.status));
      }

      if (input.search) {
        const searchPattern = `%${input.search}%`;
        const searchCondition = or(
          ilike(owners.name, searchPattern),
          ilike(owners.petName, searchPattern),
        );
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }

      const whereClause = and(...conditions);

      const [clientRows, countResult] = await Promise.all([
        ctx.db
          .select({
            planId: plans.id,
            ownerName: owners.name,
            ownerEmail: owners.email,
            ownerPhone: owners.phone,
            petName: owners.petName,
            totalBillCents: plans.totalBillCents,
            totalWithFeeCents: plans.totalWithFeeCents,
            planStatus: plans.status,
            nextPaymentAt: plans.nextPaymentAt,
            createdAt: plans.createdAt,
            totalPaidCents: sql<number>`coalesce(sum(${payments.amountCents}) filter (where ${payments.status} = 'succeeded'), 0)`,
          })
          .from(plans)
          .leftJoin(owners, eq(plans.ownerId, owners.id))
          .leftJoin(payments, eq(plans.id, payments.planId))
          .where(whereClause)
          .groupBy(plans.id, owners.id)
          .orderBy(desc(plans.createdAt))
          .limit(input.pageSize)
          .offset(offset),
        ctx.db
          .select({ total: count() })
          .from(plans)
          .leftJoin(owners, eq(plans.ownerId, owners.id))
          .where(whereClause),
      ]);

      const totalCount = Number(countResult[0]?.total ?? 0);
      const totalPages = Math.ceil(totalCount / input.pageSize);

      return {
        clients: clientRows.map((row) => ({
          ...row,
          totalPaidCents: Number(row.totalPaidCents),
        })),
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          totalCount,
          totalPages,
        },
      };
    }),

  /**
   * Get detailed plan + payment info for a specific plan at this clinic.
   */
  getClientPlanDetails: clinicProcedure
    .input(
      z.object({
        planId: z.string().uuid('Valid plan ID is required'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const clinicId = await resolveClinicId(ctx.db, ctx.session.userId);

      // Get the plan and verify it belongs to this clinic
      const [plan] = await ctx.db
        .select({
          id: plans.id,
          clinicId: plans.clinicId,
          totalBillCents: plans.totalBillCents,
          feeCents: plans.feeCents,
          totalWithFeeCents: plans.totalWithFeeCents,
          depositCents: plans.depositCents,
          remainingCents: plans.remainingCents,
          installmentCents: plans.installmentCents,
          numInstallments: plans.numInstallments,
          status: plans.status,
          depositPaidAt: plans.depositPaidAt,
          nextPaymentAt: plans.nextPaymentAt,
          completedAt: plans.completedAt,
          createdAt: plans.createdAt,
          ownerName: owners.name,
          ownerEmail: owners.email,
          ownerPhone: owners.phone,
          petName: owners.petName,
        })
        .from(plans)
        .leftJoin(owners, eq(plans.ownerId, owners.id))
        .where(and(eq(plans.id, input.planId), eq(plans.clinicId, clinicId)))
        .limit(1);

      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plan not found or does not belong to this clinic',
        });
      }

      // Get all payments for this plan
      const planPayments = await ctx.db
        .select({
          id: payments.id,
          type: payments.type,
          sequenceNum: payments.sequenceNum,
          amountCents: payments.amountCents,
          status: payments.status,
          scheduledAt: payments.scheduledAt,
          processedAt: payments.processedAt,
          failureReason: payments.failureReason,
          retryCount: payments.retryCount,
        })
        .from(payments)
        .where(eq(payments.planId, input.planId))
        .orderBy(payments.sequenceNum);

      // Get payouts for this plan
      const planPayouts = await ctx.db
        .select({
          id: payouts.id,
          amountCents: payouts.amountCents,
          clinicShareCents: payouts.clinicShareCents,
          stripeTransferId: payouts.stripeTransferId,
          status: payouts.status,
          createdAt: payouts.createdAt,
        })
        .from(payouts)
        .where(and(eq(payouts.planId, input.planId), eq(payouts.clinicId, clinicId)))
        .orderBy(desc(payouts.createdAt));

      return {
        plan,
        payments: planPayments,
        payouts: planPayouts,
      };
    }),

  /**
   * Get monthly revenue data for the clinic (for revenue chart/table).
   * Returns the last 12 months of aggregated payout data.
   */
  getMonthlyRevenue: clinicProcedure.query(async ({ ctx }) => {
    const clinicId = await resolveClinicId(ctx.db, ctx.session.userId);

    const monthlyData = await ctx.db
      .select({
        month: sql<string>`to_char(${payouts.createdAt}, 'YYYY-MM')`,
        totalPayoutCents: sql<number>`coalesce(sum(${payouts.amountCents}), 0)`,
        totalShareCents: sql<number>`coalesce(sum(${payouts.clinicShareCents}), 0)`,
        payoutCount: sql<number>`count(*)`,
      })
      .from(payouts)
      .where(
        and(
          eq(payouts.clinicId, clinicId),
          eq(payouts.status, 'succeeded'),
          sql`${payouts.createdAt} >= now() - interval '12 months'`,
        ),
      )
      .groupBy(sql`to_char(${payouts.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${payouts.createdAt}, 'YYYY-MM')`);

    return monthlyData.map((row) => ({
      month: row.month,
      totalPayoutCents: Number(row.totalPayoutCents),
      totalShareCents: Number(row.totalShareCents),
      payoutCount: Number(row.payoutCount),
    }));
  }),
});
