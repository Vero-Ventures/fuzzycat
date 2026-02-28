import { TRPCError } from '@trpc/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { cachedQuery, revalidateTag } from '@/lib/cache';
import { logger } from '@/lib/logger';
import { stripe } from '@/lib/stripe';
import { clinics, owners, payments, plans } from '@/server/db/schema';
import { logAuditEvent } from '@/server/services/audit';
import { ownerProcedure, router } from '@/server/trpc';

/** Retrieve card details from Stripe, returning null on error. */
async function fetchCardDetails(
  cardPaymentMethodId: string,
  ownerId: string,
): Promise<{ brand: string; last4: string; expMonth: number; expYear: number } | null> {
  try {
    const pm = await stripe().paymentMethods.retrieve(cardPaymentMethodId);
    if (pm.card) {
      return {
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
      };
    }
  } catch (err) {
    logger.error('Failed to retrieve card payment method from Stripe', {
      ownerId,
      paymentMethodId: cardPaymentMethodId,
      error: err,
    });
  }
  return null;
}

/** Retrieve ACH bank account details from Stripe, returning null on error. */
async function fetchBankAccountDetails(
  customerId: string,
  achPaymentMethodId: string,
  ownerId: string,
): Promise<{ bankName: string; last4: string } | null> {
  try {
    const source = await stripe().customers.retrieveSource(customerId, achPaymentMethodId);
    if ('bank_name' in source && 'last4' in source) {
      return {
        bankName: (source as { bank_name: string }).bank_name,
        last4: (source as { last4: string }).last4,
      };
    }
  } catch (err) {
    logger.error('Failed to retrieve ACH source from Stripe', {
      ownerId,
      customerId,
      sourceId: achPaymentMethodId,
      error: err,
    });
  }
  return null;
}

export const ownerRouter = router({
  healthCheck: ownerProcedure.query(() => {
    return { status: 'ok' as const, router: 'owner' };
  }),

  /**
   * Get the authenticated owner's profile information.
   */
  getProfile: ownerProcedure.query(async ({ ctx }) => {
    return cachedQuery(
      async () => {
        const [owner] = await ctx.db
          .select({
            id: owners.id,
            name: owners.name,
            email: owners.email,
            phone: owners.phone,
            petName: owners.petName,
            paymentMethod: owners.paymentMethod,
            stripeCardPaymentMethodId: owners.stripeCardPaymentMethodId,
            stripeAchPaymentMethodId: owners.stripeAchPaymentMethodId,
            addressLine1: owners.addressLine1,
            addressCity: owners.addressCity,
            addressState: owners.addressState,
            addressZip: owners.addressZip,
          })
          .from(owners)
          .where(eq(owners.id, ctx.ownerId))
          .limit(1);

        if (!owner) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Owner profile not found' });
        }

        return owner;
      },
      ['owner-profile', ctx.ownerId],
      { revalidate: 300, tags: [`owner:${ctx.ownerId}:profile`] },
    );
  }),

  /**
   * Update the authenticated owner's profile (email, phone, name).
   */
  updateProfile: ownerProcedure
    .input(
      z.object({
        name: z.string().min(1, 'Name is required').optional(),
        email: z.string().email('Valid email is required').optional(),
        phone: z
          .string()
          .regex(/^\+[1-9]\d{1,14}$/, 'Phone must be in E.164 format (e.g., +15551234567)')
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, string> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.email !== undefined) updateData.email = input.email;
      if (input.phone !== undefined) updateData.phone = input.phone;

      if (Object.keys(updateData).length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No fields to update' });
      }

      const [updated] = await ctx.db
        .update(owners)
        .set(updateData)
        .where(eq(owners.id, ctx.ownerId))
        .returning({
          id: owners.id,
          name: owners.name,
          email: owners.email,
          phone: owners.phone,
          petName: owners.petName,
          paymentMethod: owners.paymentMethod,
        });

      revalidateTag(`owner:${ctx.ownerId}:profile`);

      return updated;
    }),

  /**
   * Update the authenticated owner's payment method preference.
   * Validates that the owner has a saved instrument for the target method.
   */
  updatePaymentMethod: ownerProcedure
    .input(
      z.object({
        paymentMethod: z.enum(['debit_card', 'bank_account']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the owner has a saved instrument for the target method
      const [owner] = await ctx.db
        .select({
          stripeCardPaymentMethodId: owners.stripeCardPaymentMethodId,
          stripeAchPaymentMethodId: owners.stripeAchPaymentMethodId,
          paymentMethod: owners.paymentMethod,
        })
        .from(owners)
        .where(eq(owners.id, ctx.ownerId))
        .limit(1);

      if (input.paymentMethod === 'debit_card' && !owner?.stripeCardPaymentMethodId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No debit card on file. Please add a card first.',
        });
      }

      if (input.paymentMethod === 'bank_account' && !owner?.stripeAchPaymentMethodId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No bank account on file. Please connect a bank account first.',
        });
      }

      const oldMethod = owner?.paymentMethod;

      const [updated] = await ctx.db
        .update(owners)
        .set({ paymentMethod: input.paymentMethod })
        .where(eq(owners.id, ctx.ownerId))
        .returning({
          id: owners.id,
          paymentMethod: owners.paymentMethod,
        });

      await logAuditEvent({
        entityType: 'owner',
        entityId: ctx.ownerId,
        action: 'status_changed',
        oldValue: { paymentMethod: oldMethod },
        newValue: { paymentMethod: input.paymentMethod },
        actorType: 'owner',
        actorId: ctx.ownerId,
      });

      revalidateTag(`owner:${ctx.ownerId}:profile`);

      return updated;
    }),

  /**
   * Create a Stripe Checkout Session in setup mode for collecting a debit card.
   * Redirects the user to Stripe's hosted page (avoids needing @stripe/react-stripe-js).
   */
  setupCardPaymentMethod: ownerProcedure
    .input(
      z.object({
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [owner] = await ctx.db
        .select({ stripeCustomerId: owners.stripeCustomerId })
        .from(owners)
        .where(eq(owners.id, ctx.ownerId))
        .limit(1);

      if (!owner?.stripeCustomerId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No Stripe customer found for this account.',
        });
      }

      const session = await stripe().checkout.sessions.create({
        customer: owner.stripeCustomerId,
        mode: 'setup',
        payment_method_types: ['card'],
        success_url: `${input.successUrl}?setup_session={CHECKOUT_SESSION_ID}`,
        cancel_url: input.cancelUrl,
        metadata: {
          ownerId: ctx.ownerId,
        },
      });

      return {
        sessionId: session.id,
        sessionUrl: session.url,
      };
    }),

  /**
   * Confirm a card setup after the user completes Stripe Checkout.
   * Retrieves the Checkout Session, extracts the SetupIntent, and saves the payment method.
   */
  confirmCardPaymentMethod: ownerProcedure
    .input(
      z.object({
        sessionId: z.string().min(1, 'Checkout session ID is required'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await stripe().checkout.sessions.retrieve(input.sessionId);

      if (session.status !== 'complete') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Checkout session is not complete (status: ${session.status})`,
        });
      }

      const setupIntentId =
        typeof session.setup_intent === 'string' ? session.setup_intent : session.setup_intent?.id;

      if (!setupIntentId) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Checkout session ${input.sessionId} has no SetupIntent`,
        });
      }

      const setupIntent = await stripe().setupIntents.retrieve(setupIntentId);

      if (setupIntent.status !== 'succeeded') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `SetupIntent is not succeeded (status: ${setupIntent.status})`,
        });
      }

      const paymentMethodId =
        typeof setupIntent.payment_method === 'string'
          ? setupIntent.payment_method
          : setupIntent.payment_method?.id;

      if (!paymentMethodId) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `SetupIntent ${setupIntentId} has no payment method`,
        });
      }

      await ctx.db
        .update(owners)
        .set({
          stripeCardPaymentMethodId: paymentMethodId,
          paymentMethod: 'debit_card',
        })
        .where(eq(owners.id, ctx.ownerId));

      await logAuditEvent({
        entityType: 'owner',
        entityId: ctx.ownerId,
        action: 'status_changed',
        oldValue: null,
        newValue: { stripeCardPaymentMethodId: paymentMethodId, paymentMethod: 'debit_card' },
        actorType: 'owner',
        actorId: ctx.ownerId,
      });

      revalidateTag(`owner:${ctx.ownerId}:profile`);

      return { success: true as const, paymentMethodId };
    }),

  /**
   * Retrieve saved payment instrument details from Stripe.
   * Returns card brand/last4/expiry and/or bank name/last4 depending on what's on file.
   */
  getPaymentMethodDetails: ownerProcedure.query(async ({ ctx }) => {
    const [owner] = await ctx.db
      .select({
        paymentMethod: owners.paymentMethod,
        stripeCardPaymentMethodId: owners.stripeCardPaymentMethodId,
        stripeAchPaymentMethodId: owners.stripeAchPaymentMethodId,
        stripeCustomerId: owners.stripeCustomerId,
      })
      .from(owners)
      .where(eq(owners.id, ctx.ownerId))
      .limit(1);

    if (!owner) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Owner not found' });
    }

    const card = owner.stripeCardPaymentMethodId
      ? await fetchCardDetails(owner.stripeCardPaymentMethodId, ctx.ownerId)
      : null;

    const bankAccount =
      owner.stripeAchPaymentMethodId && owner.stripeCustomerId
        ? await fetchBankAccountDetails(
            owner.stripeCustomerId,
            owner.stripeAchPaymentMethodId,
            ctx.ownerId,
          )
        : null;

    return {
      currentMethod: owner.paymentMethod,
      card,
      bankAccount,
    };
  }),

  /**
   * Get all payment plans for the authenticated owner, with payment progress.
   */
  getPlans: ownerProcedure.query(async ({ ctx }) => {
    const plansWithProgress = await ctx.db
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
        nextPaymentAt: plans.nextPaymentAt,
        depositPaidAt: plans.depositPaidAt,
        completedAt: plans.completedAt,
        createdAt: plans.createdAt,
        clinicName: clinics.name,
        succeededCount: sql<number>`count(${payments.id}) filter (where ${payments.status} = 'succeeded')`,
        totalPaidCents: sql<number>`coalesce(sum(${payments.amountCents}) filter (where ${payments.status} = 'succeeded'), 0)`,
        totalPayments: sql<number>`count(${payments.id})`,
      })
      .from(plans)
      .leftJoin(clinics, eq(plans.clinicId, clinics.id))
      .leftJoin(payments, eq(plans.id, payments.planId))
      .where(eq(plans.ownerId, ctx.ownerId))
      .groupBy(plans.id, clinics.id)
      .orderBy(desc(plans.createdAt));

    return plansWithProgress.map((p) => ({
      ...p,
      succeededCount: Number(p.succeededCount),
      totalPaidCents: Number(p.totalPaidCents),
      totalPayments: Number(p.totalPayments),
    }));
  }),

  /**
   * Get a single payment plan by ID for the authenticated owner, with payment progress.
   */
  getPlanById: ownerProcedure
    .input(z.object({ planId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
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
          nextPaymentAt: plans.nextPaymentAt,
          depositPaidAt: plans.depositPaidAt,
          completedAt: plans.completedAt,
          createdAt: plans.createdAt,
          clinicName: clinics.name,
          succeededCount: sql<number>`count(${payments.id}) filter (where ${payments.status} = 'succeeded')`,
          totalPaidCents: sql<number>`coalesce(sum(${payments.amountCents}) filter (where ${payments.status} = 'succeeded'), 0)`,
          totalPayments: sql<number>`count(${payments.id})`,
        })
        .from(plans)
        .leftJoin(clinics, eq(plans.clinicId, clinics.id))
        .leftJoin(payments, eq(plans.id, payments.planId))
        .where(and(eq(plans.id, input.planId), eq(plans.ownerId, ctx.ownerId)))
        .groupBy(plans.id, clinics.id);

      const plan = result[0];
      if (!plan) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found' });
      }

      return {
        ...plan,
        succeededCount: Number(plan.succeededCount),
        totalPaidCents: Number(plan.totalPaidCents),
        totalPayments: Number(plan.totalPayments),
      };
    }),

  /**
   * Get paginated payment history for a specific plan.
   * Owner must own the plan.
   */
  getPaymentHistory: ownerProcedure
    .input(
      z.object({
        planId: z.string().uuid(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [plan] = await ctx.db
        .select({ id: plans.id, ownerId: plans.ownerId })
        .from(plans)
        .where(eq(plans.id, input.planId))
        .limit(1);

      if (!plan) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found' });
      }

      // Admin bypass is handled by ownerProcedure allowing admin role
      if (ctx.session.role !== 'admin' && plan.ownerId !== ctx.ownerId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this plan' });
      }

      const offset = (input.page - 1) * input.pageSize;

      const [planPayments, countResult] = await Promise.all([
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
          .orderBy(payments.sequenceNum)
          .limit(input.pageSize)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(payments)
          .where(eq(payments.planId, input.planId)),
      ]);

      const totalCount = Number(countResult[0]?.count ?? 0);
      const totalPages = Math.ceil(totalCount / input.pageSize);

      return {
        payments: planPayments,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          totalCount,
          totalPages,
        },
      };
    }),

  /**
   * Get the 10 most recent payments across all of the owner's plans in a single query.
   * Eliminates the N+1 waterfall of fetching plans, then fetching payments per plan.
   */
  getRecentPayments: ownerProcedure.query(async ({ ctx }) => {
    const recentPayments = await ctx.db
      .select({
        id: payments.id,
        type: payments.type,
        sequenceNum: payments.sequenceNum,
        amountCents: payments.amountCents,
        status: payments.status,
        scheduledAt: payments.scheduledAt,
        processedAt: payments.processedAt,
        clinicName: clinics.name,
      })
      .from(payments)
      .innerJoin(plans, eq(payments.planId, plans.id))
      .leftJoin(clinics, eq(plans.clinicId, clinics.id))
      .where(eq(plans.ownerId, ctx.ownerId))
      .orderBy(desc(payments.scheduledAt))
      .limit(10);

    return recentPayments;
  }),

  /**
   * Get a summary of active plans with next upcoming payment.
   */
  getDashboardSummary: ownerProcedure.query(async ({ ctx }) => {
    // Run all three independent queries in parallel
    const [nextPaymentResult, totalsResult, planCountsResult] = await Promise.all([
      // Next upcoming payment across all active plans
      ctx.db
        .select({
          id: payments.id,
          planId: payments.planId,
          amountCents: payments.amountCents,
          scheduledAt: payments.scheduledAt,
          type: payments.type,
          sequenceNum: payments.sequenceNum,
        })
        .from(payments)
        .innerJoin(plans, eq(payments.planId, plans.id))
        .where(and(eq(plans.ownerId, ctx.ownerId), eq(payments.status, 'pending')))
        .orderBy(payments.scheduledAt)
        .limit(1),

      // Total paid and total remaining across all plans
      ctx.db
        .select({
          totalPaidCents: sql<number>`coalesce(sum(${payments.amountCents}) filter (where ${payments.status} = 'succeeded'), 0)`,
          totalRemainingCents: sql<number>`coalesce(sum(${payments.amountCents}) filter (where ${payments.status} in ('pending', 'processing', 'failed', 'retried')), 0)`,
        })
        .from(payments)
        .innerJoin(plans, eq(payments.planId, plans.id))
        .where(eq(plans.ownerId, ctx.ownerId)),

      // Count active plans
      ctx.db
        .select({
          activePlans: sql<number>`count(*) filter (where ${plans.status} in ('active', 'deposit_paid'))`,
          totalPlans: sql<number>`count(*)`,
        })
        .from(plans)
        .where(eq(plans.ownerId, ctx.ownerId)),
    ]);

    const [nextPayment] = nextPaymentResult;
    const [totals] = totalsResult;
    const [planCounts] = planCountsResult;

    return {
      nextPayment: nextPayment ?? null,
      totalPaidCents: Number(totals?.totalPaidCents ?? 0),
      totalRemainingCents: Number(totals?.totalRemainingCents ?? 0),
      activePlans: Number(planCounts?.activePlans ?? 0),
      totalPlans: Number(planCounts?.totalPlans ?? 0),
    };
  }),
});
