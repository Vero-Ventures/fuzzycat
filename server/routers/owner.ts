import { TRPCError } from '@trpc/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { clinics, owners, payments, plans } from '@/server/db/schema';
import { ownerProcedure, router } from '@/server/trpc';

export const ownerRouter = router({
  healthCheck: ownerProcedure.query(() => {
    return { status: 'ok' as const, router: 'owner' };
  }),

  /**
   * Get the authenticated owner's profile information.
   */
  getProfile: ownerProcedure.query(async ({ ctx }) => {
    const [owner] = await ctx.db
      .select({
        id: owners.id,
        name: owners.name,
        email: owners.email,
        phone: owners.phone,
        petName: owners.petName,
        paymentMethod: owners.paymentMethod,
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

      return updated;
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
