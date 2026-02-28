import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { cachedQuery, revalidateTag } from '@/lib/cache';
import { publicEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { stripe } from '@/lib/stripe';
import { isMfaEnabled } from '@/lib/supabase/mfa';
import { generateCsv } from '@/lib/utils/csv';
import { formatCents } from '@/lib/utils/money';
import { clinics, owners, payments, payouts, plans } from '@/server/db/schema';
import { logAuditEvent } from '@/server/services/audit';
import { sendClinicWelcome } from '@/server/services/email';
import { createConnectAccount, createOnboardingLink } from '@/server/services/stripe/connect';
import { clinicProcedure, protectedProcedure, router } from '@/server/trpc';

// ── Helpers ──────────────────────────────────────────────────────────

/** Escape ILIKE special characters (% and _) in user input */
function escapeIlike(input: string): string {
  return input.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

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
 * Look up the clinic record by its database ID.
 * Throws NOT_FOUND if no clinic is found.
 */
async function getClinicById(
  db: Parameters<typeof clinicProcedure.query>[0] extends (opts: infer O) => unknown
    ? O extends { ctx: infer C }
      ? C extends { db: infer D }
        ? D
        : never
      : never
    : never,
  clinicId: string,
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
    .where(eq(clinics.id, clinicId))
    .limit(1);

  if (!clinic) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Clinic profile not found' });
  }

  return clinic;
}

/** Verify the Stripe Connect account is fully active. Throws on failure. */
async function verifyStripeReady(clinic: { id: string; stripeAccountId: string | null }) {
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
      const searchPattern = `%${escapeIlike(input.query)}%`;
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
    return cachedQuery(
      () => getClinicById(ctx.db, ctx.clinicId),
      ['clinic-profile', ctx.clinicId],
      { revalidate: 300, tags: [`clinic:${ctx.clinicId}:profile`] },
    );
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
      const clinic = await getClinicById(ctx.db, ctx.clinicId);

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

      revalidateTag(`clinic:${ctx.clinicId}:profile`);
      revalidateTag('admin:clinics');

      return updated;
    }),

  /**
   * Start Stripe Connect onboarding for the authenticated clinic.
   * Creates a Connect account if one doesn't exist, then generates an
   * onboarding link that redirects the user to Stripe's hosted onboarding.
   */
  startStripeOnboarding: clinicProcedure.mutation(async ({ ctx }) => {
    const clinic = await getClinicById(ctx.db, ctx.clinicId);
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
    const clinic = await getClinicById(ctx.db, ctx.clinicId);

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

    // Check MFA status from Supabase (skip when MFA feature flag is off)
    const mfaRequired = isMfaEnabled();
    let mfaEnabled = true; // default to true when MFA is disabled
    if (mfaRequired) {
      const { data: mfaFactors } = await ctx.supabase.auth.mfa.listFactors();
      mfaEnabled = mfaFactors?.totp?.some((f) => f.status === 'verified') ?? false;
    }

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
      mfaRequired,
      allComplete: profileComplete && stripeStatus === 'active' && mfaEnabled,
    };
  }),

  /**
   * Mark clinic as active after all onboarding steps are complete.
   * Requires: profile complete, Stripe Connect active, MFA enabled.
   * Sends a welcome email on successful activation.
   */
  completeOnboarding: clinicProcedure.mutation(async ({ ctx }) => {
    const clinic = await getClinicById(ctx.db, ctx.clinicId);

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
    await verifyStripeReady(clinic);

    // Verify MFA is enabled (skip when MFA feature flag is off)
    if (isMfaEnabled()) {
      const { data: mfaFactors } = await ctx.supabase.auth.mfa.listFactors();
      const mfaEnabled = mfaFactors?.totp?.some((f) => f.status === 'verified') ?? false;

      if (!mfaEnabled) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Please enable multi-factor authentication before finishing onboarding.',
        });
      }
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

    revalidateTag(`clinic:${clinic.id}:profile`);
    revalidateTag('admin:clinics');

    return { status: 'active' as const, alreadyActive: false };
  }),

  // ── Dashboard procedures (Issue #27) ─────────────────────────────

  /**
   * Get dashboard statistics for the authenticated clinic.
   * Returns: active plans count, total revenue earned (3% share),
   * pending payouts, and recent enrollments.
   */
  getDashboardStats: clinicProcedure.query(async ({ ctx }) => {
    const { clinicId } = ctx;

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
      const { clinicId } = ctx;

      const offset = (input.page - 1) * input.pageSize;

      // Build where conditions
      const conditions = [eq(plans.clinicId, clinicId)];

      if (input.status) {
        conditions.push(eq(plans.status, input.status));
      }

      if (input.search) {
        const searchPattern = `%${escapeIlike(input.search)}%`;
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
          .select({ total: sql<number>`count(*)` })
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
      const { clinicId } = ctx;

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

      // Get payments and payouts in parallel (both independent after plan check)
      const [planPayments, planPayouts] = await Promise.all([
        ctx.db
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
          .orderBy(payments.sequenceNum),

        ctx.db
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
          .orderBy(desc(payouts.createdAt)),
      ]);

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
    const { clinicId } = ctx;

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

  // ── Reporting procedures (Issue #36) ─────────────────────────────

  /**
   * Get revenue report with monthly breakdown within a date range.
   * Returns: month, enrollments, revenue, payouts, clinic share.
   */
  getRevenueReport: clinicProcedure
    .input(
      z.object({
        dateFrom: z.string().datetime(),
        dateTo: z.string().datetime(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { clinicId } = ctx;
      const fromDate = new Date(input.dateFrom);
      const toDate = new Date(input.dateTo);

      // Get monthly revenue from payouts
      const revenueData = await ctx.db
        .select({
          month: sql<string>`to_char(${payouts.createdAt}, 'YYYY-MM')`,
          revenueCents: sql<number>`coalesce(sum(${payouts.amountCents}), 0)`,
          clinicShareCents: sql<number>`coalesce(sum(${payouts.clinicShareCents}), 0)`,
          payoutCount: sql<number>`count(*)`,
        })
        .from(payouts)
        .where(
          and(
            eq(payouts.clinicId, clinicId),
            eq(payouts.status, 'succeeded'),
            gte(payouts.createdAt, fromDate),
            lte(payouts.createdAt, toDate),
          ),
        )
        .groupBy(sql`to_char(${payouts.createdAt}, 'YYYY-MM')`)
        .orderBy(sql`to_char(${payouts.createdAt}, 'YYYY-MM')`);

      // Get monthly enrollment counts
      const enrollmentData = await ctx.db
        .select({
          month: sql<string>`to_char(${plans.createdAt}, 'YYYY-MM')`,
          enrollments: sql<number>`count(*)`,
        })
        .from(plans)
        .where(
          and(
            eq(plans.clinicId, clinicId),
            gte(plans.createdAt, fromDate),
            lte(plans.createdAt, toDate),
          ),
        )
        .groupBy(sql`to_char(${plans.createdAt}, 'YYYY-MM')`)
        .orderBy(sql`to_char(${plans.createdAt}, 'YYYY-MM')`);

      // Merge revenue and enrollment data by month
      const enrollmentMap = new Map(enrollmentData.map((e) => [e.month, Number(e.enrollments)]));

      // Collect all months
      const allMonths = new Set<string>();
      for (const r of revenueData) allMonths.add(r.month);
      for (const e of enrollmentData) allMonths.add(e.month);
      const sortedMonths = [...allMonths].sort();

      const revenueMap = new Map(
        revenueData.map((r) => [
          r.month,
          {
            revenueCents: Number(r.revenueCents),
            clinicShareCents: Number(r.clinicShareCents),
            payoutCount: Number(r.payoutCount),
          },
        ]),
      );

      return sortedMonths.map((month) => ({
        month,
        enrollments: enrollmentMap.get(month) ?? 0,
        revenueCents: revenueMap.get(month)?.revenueCents ?? 0,
        payoutsCents: revenueMap.get(month)?.revenueCents ?? 0,
        clinicShareCents: revenueMap.get(month)?.clinicShareCents ?? 0,
      }));
    }),

  /**
   * Get enrollment trends — enrollment counts by month for the last N months.
   */
  getEnrollmentTrends: clinicProcedure
    .input(
      z
        .object({
          months: z.number().int().min(1).max(36).default(12),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const { clinicId } = ctx;
      const monthsBack = input?.months ?? 12;

      const trendData = await ctx.db
        .select({
          month: sql<string>`to_char(${plans.createdAt}, 'YYYY-MM')`,
          enrollments: sql<number>`count(*)`,
        })
        .from(plans)
        .where(
          and(
            eq(plans.clinicId, clinicId),
            sql`${plans.createdAt} >= now() - make_interval(months => ${monthsBack})`,
          ),
        )
        .groupBy(sql`to_char(${plans.createdAt}, 'YYYY-MM')`)
        .orderBy(sql`to_char(${plans.createdAt}, 'YYYY-MM')`);

      return trendData.map((row) => ({
        month: row.month,
        enrollments: Number(row.enrollments),
      }));
    }),

  /**
   * Get the clinic's default rate (defaulted plans / total plans).
   */
  getDefaultRate: clinicProcedure.query(async ({ ctx }) => {
    const { clinicId } = ctx;

    const [result] = await ctx.db
      .select({
        totalPlans: sql<number>`count(*)`,
        defaultedPlans: sql<number>`count(*) filter (where ${plans.status} = 'defaulted')`,
      })
      .from(plans)
      .where(eq(plans.clinicId, clinicId));

    const total = Number(result?.totalPlans ?? 0);
    const defaulted = Number(result?.defaultedPlans ?? 0);
    const rate = total > 0 ? (defaulted / total) * 100 : 0;

    return {
      totalPlans: total,
      defaultedPlans: defaulted,
      defaultRate: Math.round(rate * 100) / 100,
    };
  }),

  /**
   * Export all clients as a CSV string.
   */
  exportClientsCSV: clinicProcedure.query(async ({ ctx }) => {
    const { clinicId } = ctx;

    const clientRows = await ctx.db
      .select({
        ownerName: owners.name,
        ownerEmail: owners.email,
        petName: owners.petName,
        planStatus: plans.status,
        totalBillCents: plans.totalBillCents,
        totalPaidCents: sql<number>`coalesce(sum(${payments.amountCents}) filter (where ${payments.status} = 'succeeded'), 0)`,
        remainingCents: plans.remainingCents,
      })
      .from(plans)
      .leftJoin(owners, eq(plans.ownerId, owners.id))
      .leftJoin(payments, eq(plans.id, payments.planId))
      .where(eq(plans.clinicId, clinicId))
      .groupBy(plans.id, owners.id)
      .orderBy(desc(plans.createdAt))
      .limit(10000);

    const headers = [
      'Owner Name',
      'Email',
      'Pet Name',
      'Plan Status',
      'Total Bill',
      'Paid Amount',
      'Remaining',
    ];

    const rows = clientRows.map((row) => [
      row.ownerName ?? '',
      row.ownerEmail ?? '',
      row.petName ?? '',
      row.planStatus ?? '',
      formatCents(row.totalBillCents),
      formatCents(Number(row.totalPaidCents)),
      formatCents(row.remainingCents),
    ]);

    return { csv: generateCsv(headers, rows) };
  }),

  /**
   * Export revenue report as CSV within a date range.
   */
  exportRevenueCSV: clinicProcedure
    .input(
      z.object({
        dateFrom: z.string().datetime(),
        dateTo: z.string().datetime(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { clinicId } = ctx;
      const fromDate = new Date(input.dateFrom);
      const toDate = new Date(input.dateTo);

      const revenueData = await ctx.db
        .select({
          month: sql<string>`to_char(${payouts.createdAt}, 'YYYY-MM')`,
          revenueCents: sql<number>`coalesce(sum(${payouts.amountCents}), 0)`,
          clinicShareCents: sql<number>`coalesce(sum(${payouts.clinicShareCents}), 0)`,
          payoutCount: sql<number>`count(*)`,
        })
        .from(payouts)
        .where(
          and(
            eq(payouts.clinicId, clinicId),
            eq(payouts.status, 'succeeded'),
            gte(payouts.createdAt, fromDate),
            lte(payouts.createdAt, toDate),
          ),
        )
        .groupBy(sql`to_char(${payouts.createdAt}, 'YYYY-MM')`)
        .orderBy(sql`to_char(${payouts.createdAt}, 'YYYY-MM')`);

      const headers = ['Month', 'Revenue', 'Clinic Share', 'Payouts'];
      const rows = revenueData.map((row) => [
        row.month,
        formatCents(Number(row.revenueCents)),
        formatCents(Number(row.clinicShareCents)),
        Number(row.payoutCount),
      ]);

      return { csv: generateCsv(headers, rows) };
    }),

  /**
   * Export payout history as CSV.
   */
  exportPayoutsCSV: clinicProcedure.query(async ({ ctx }) => {
    const { clinicId } = ctx;

    const payoutRows = await ctx.db
      .select({
        payoutId: payouts.id,
        amountCents: payouts.amountCents,
        clinicShareCents: payouts.clinicShareCents,
        status: payouts.status,
        stripeTransferId: payouts.stripeTransferId,
        createdAt: payouts.createdAt,
        ownerName: owners.name,
        petName: owners.petName,
      })
      .from(payouts)
      .leftJoin(plans, eq(payouts.planId, plans.id))
      .leftJoin(owners, eq(plans.ownerId, owners.id))
      .where(eq(payouts.clinicId, clinicId))
      .orderBy(desc(payouts.createdAt))
      .limit(10000);

    const headers = [
      'Payout ID',
      'Owner',
      'Pet',
      'Amount',
      'Clinic Share',
      'Status',
      'Stripe Transfer',
      'Date',
    ];

    const rows = payoutRows.map((row) => [
      row.payoutId,
      row.ownerName ?? '',
      row.petName ?? '',
      formatCents(row.amountCents),
      formatCents(row.clinicShareCents),
      row.status,
      row.stripeTransferId ?? '',
      row.createdAt ? new Date(row.createdAt).toISOString() : '',
    ]);

    return { csv: generateCsv(headers, rows) };
  }),
});
