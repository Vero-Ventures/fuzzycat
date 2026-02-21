import { TRPCError } from '@trpc/server';
import { and, count, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  auditLog,
  clinics,
  owners,
  payments,
  payouts,
  plans,
  riskPool,
  softCollections,
} from '@/server/db/schema';
import {
  AUDIT_ENTITY_TYPES,
  getAuditLogByEntity,
  getAuditLogByType,
  logAuditEvent,
} from '@/server/services/audit';
import { getRiskPoolBalance, getRiskPoolHealth } from '@/server/services/guarantee';
import { cancelSoftCollection } from '@/server/services/soft-collection';
import { adminProcedure, router } from '@/server/trpc';

export const adminRouter = router({
  healthCheck: adminProcedure.query(() => {
    return { status: 'ok' as const, router: 'admin' };
  }),

  /**
   * Get risk pool balance breakdown (contributions, claims, recoveries, net).
   */
  riskPoolBalance: adminProcedure.query(async () => {
    return getRiskPoolBalance();
  }),

  /**
   * Get risk pool health metrics (balance, outstanding guarantees,
   * coverage ratio, active plan count).
   */
  riskPoolHealth: adminProcedure.query(async () => {
    return getRiskPoolHealth();
  }),

  /**
   * Get audit log entries for a specific entity.
   */
  auditLogByEntity: adminProcedure
    .input(
      z.object({
        entityType: z.enum(AUDIT_ENTITY_TYPES),
        entityId: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      return getAuditLogByEntity(input.entityType, input.entityId);
    }),

  /**
   * Get audit log entries by entity type with pagination.
   */
  auditLogByType: adminProcedure
    .input(
      z.object({
        entityType: z.enum(AUDIT_ENTITY_TYPES),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      return getAuditLogByType(input.entityType, {
        limit: input.limit,
        offset: input.offset,
      });
    }),

  // ── Platform-wide statistics (Issue #28) ────────────────────────────

  /**
   * Get platform-wide metrics: enrollments, plan counts by status,
   * total revenue, platform fees collected, and default rate.
   */
  getPlatformStats: adminProcedure.query(async ({ ctx }) => {
    const [planCounts, revenueResult, feesResult] = await Promise.all([
      // Plan counts by status
      ctx.db
        .select({
          totalEnrollments: sql<number>`count(*)`,
          activePlans: sql<number>`count(*) filter (where ${plans.status} in ('active', 'deposit_paid'))`,
          completedPlans: sql<number>`count(*) filter (where ${plans.status} = 'completed')`,
          defaultedPlans: sql<number>`count(*) filter (where ${plans.status} = 'defaulted')`,
        })
        .from(plans),

      // Total revenue (sum of all succeeded payouts)
      ctx.db
        .select({
          totalRevenueCents: sql<number>`coalesce(sum(${payouts.amountCents}), 0)`,
        })
        .from(payouts)
        .where(eq(payouts.status, 'succeeded')),

      // Total platform fees collected
      ctx.db
        .select({
          totalFeesCents: sql<number>`coalesce(sum(${plans.feeCents}), 0)`,
        })
        .from(plans)
        .where(
          or(
            eq(plans.status, 'active'),
            eq(plans.status, 'deposit_paid'),
            eq(plans.status, 'completed'),
          ),
        ),
    ]);

    const total = Number(planCounts[0]?.totalEnrollments ?? 0);
    const defaulted = Number(planCounts[0]?.defaultedPlans ?? 0);
    const defaultRate = total > 0 ? (defaulted / total) * 100 : 0;

    return {
      totalEnrollments: total,
      activePlans: Number(planCounts[0]?.activePlans ?? 0),
      completedPlans: Number(planCounts[0]?.completedPlans ?? 0),
      defaultedPlans: defaulted,
      totalRevenueCents: Number(revenueResult[0]?.totalRevenueCents ?? 0),
      totalFeesCents: Number(feesResult[0]?.totalFeesCents ?? 0),
      defaultRate: Math.round(defaultRate * 100) / 100,
    };
  }),

  /**
   * Paginated list of all clinics with enrollment count, revenue, and Stripe status.
   * Supports status filter, text search, and limit/offset pagination.
   */
  getClinics: adminProcedure
    .input(
      z.object({
        status: z.enum(['pending', 'active', 'suspended']).optional(),
        search: z.string().max(100).optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.status) {
        conditions.push(eq(clinics.status, input.status));
      }

      if (input.search) {
        const searchPattern = `%${input.search}%`;
        const searchCondition = or(
          ilike(clinics.name, searchPattern),
          ilike(clinics.email, searchPattern),
        );
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [clinicRows, countResult] = await Promise.all([
        ctx.db
          .select({
            id: clinics.id,
            name: clinics.name,
            email: clinics.email,
            status: clinics.status,
            stripeAccountId: clinics.stripeAccountId,
            createdAt: clinics.createdAt,
            enrollmentCount: sql<number>`count(distinct ${plans.id})`,
            totalRevenueCents: sql<number>`coalesce(sum(case when ${payouts.status} = 'succeeded' then ${payouts.amountCents} else 0 end), 0)`,
          })
          .from(clinics)
          .leftJoin(plans, eq(clinics.id, plans.clinicId))
          .leftJoin(payouts, eq(clinics.id, payouts.clinicId))
          .where(whereClause)
          .groupBy(clinics.id)
          .orderBy(desc(clinics.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db.select({ total: count() }).from(clinics).where(whereClause),
      ]);

      const totalCount = Number(countResult[0]?.total ?? 0);

      return {
        clinics: clinicRows.map((row) => ({
          ...row,
          enrollmentCount: Number(row.enrollmentCount),
          totalRevenueCents: Number(row.totalRevenueCents),
          stripeConnected: row.stripeAccountId !== null,
        })),
        pagination: {
          limit: input.limit,
          offset: input.offset,
          totalCount,
        },
      };
    }),

  /**
   * Approve or suspend a clinic. Logs audit event.
   */
  updateClinicStatus: adminProcedure
    .input(
      z.object({
        clinicId: z.string().uuid(),
        status: z.enum(['active', 'suspended']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get current clinic status
      const [clinic] = await ctx.db
        .select({ id: clinics.id, status: clinics.status })
        .from(clinics)
        .where(eq(clinics.id, input.clinicId))
        .limit(1);

      if (!clinic) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Clinic not found' });
      }

      const [updated] = await ctx.db
        .update(clinics)
        .set({ status: input.status })
        .where(eq(clinics.id, input.clinicId))
        .returning({
          id: clinics.id,
          name: clinics.name,
          status: clinics.status,
        });

      await logAuditEvent({
        entityType: 'clinic',
        entityId: input.clinicId,
        action: 'status_changed',
        oldValue: { status: clinic.status },
        newValue: { status: input.status },
        actorType: 'admin',
        actorId: ctx.session.userId,
      });

      return updated;
    }),

  /**
   * Paginated list of all payments across the platform.
   * Supports filters: status, clinicId, dateFrom/dateTo.
   * Includes plan and owner info via JOIN.
   */
  getPayments: adminProcedure
    .input(
      z.object({
        status: z
          .enum(['pending', 'processing', 'succeeded', 'failed', 'retried', 'written_off'])
          .optional(),
        clinicId: z.string().uuid().optional(),
        dateFrom: z.string().datetime().optional(),
        dateTo: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.status) {
        conditions.push(eq(payments.status, input.status));
      }

      if (input.clinicId) {
        conditions.push(eq(plans.clinicId, input.clinicId));
      }

      if (input.dateFrom) {
        conditions.push(gte(payments.scheduledAt, new Date(input.dateFrom)));
      }

      if (input.dateTo) {
        conditions.push(lte(payments.scheduledAt, new Date(input.dateTo)));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [paymentRows, countResult] = await Promise.all([
        ctx.db
          .select({
            id: payments.id,
            type: payments.type,
            sequenceNum: payments.sequenceNum,
            amountCents: payments.amountCents,
            status: payments.status,
            retryCount: payments.retryCount,
            scheduledAt: payments.scheduledAt,
            processedAt: payments.processedAt,
            failureReason: payments.failureReason,
            planId: payments.planId,
            ownerName: owners.name,
            ownerEmail: owners.email,
            clinicName: clinics.name,
            clinicId: plans.clinicId,
          })
          .from(payments)
          .leftJoin(plans, eq(payments.planId, plans.id))
          .leftJoin(owners, eq(plans.ownerId, owners.id))
          .leftJoin(clinics, eq(plans.clinicId, clinics.id))
          .where(whereClause)
          .orderBy(desc(payments.scheduledAt))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db
          .select({ total: count() })
          .from(payments)
          .leftJoin(plans, eq(payments.planId, plans.id))
          .where(whereClause),
      ]);

      const totalCount = Number(countResult[0]?.total ?? 0);

      return {
        payments: paymentRows,
        pagination: {
          limit: input.limit,
          offset: input.offset,
          totalCount,
        },
      };
    }),

  /**
   * Manually retry a failed payment. Updates retryCount, sets status back
   * to pending, and creates an audit log entry.
   */
  retryPayment: adminProcedure
    .input(
      z.object({
        paymentId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get current payment
      const [payment] = await ctx.db
        .select({
          id: payments.id,
          status: payments.status,
          retryCount: payments.retryCount,
        })
        .from(payments)
        .where(eq(payments.id, input.paymentId))
        .limit(1);

      if (!payment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Payment not found' });
      }

      if (payment.status !== 'failed') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only failed payments can be retried',
        });
      }

      const newRetryCount = (payment.retryCount ?? 0) + 1;

      const [updated] = await ctx.db
        .update(payments)
        .set({
          status: 'pending',
          retryCount: newRetryCount,
        })
        .where(eq(payments.id, input.paymentId))
        .returning({
          id: payments.id,
          status: payments.status,
          retryCount: payments.retryCount,
        });

      await logAuditEvent({
        entityType: 'payment',
        entityId: input.paymentId,
        action: 'retried',
        oldValue: { status: payment.status, retryCount: payment.retryCount },
        newValue: { status: 'pending', retryCount: newRetryCount },
        actorType: 'admin',
        actorId: ctx.session.userId,
      });

      return updated;
    }),

  /**
   * Paginated list of risk pool entries (contributions, claims, recoveries).
   */
  getRiskPoolDetails: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [entries, countResult] = await Promise.all([
        ctx.db
          .select({
            id: riskPool.id,
            planId: riskPool.planId,
            contributionCents: riskPool.contributionCents,
            type: riskPool.type,
            createdAt: riskPool.createdAt,
          })
          .from(riskPool)
          .orderBy(desc(riskPool.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db.select({ total: count() }).from(riskPool),
      ]);

      const totalCount = Number(countResult[0]?.total ?? 0);

      return {
        entries,
        pagination: {
          limit: input.limit,
          offset: input.offset,
          totalCount,
        },
      };
    }),

  /**
   * List of defaulted plans with owner info, total bill, remaining cents,
   * and the date the plan was last updated (proxy for default date).
   */
  getDefaultedPlans: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [defaultedRows, countResult] = await Promise.all([
        ctx.db
          .select({
            id: plans.id,
            totalBillCents: plans.totalBillCents,
            totalWithFeeCents: plans.totalWithFeeCents,
            remainingCents: plans.remainingCents,
            createdAt: plans.createdAt,
            updatedAt: plans.updatedAt,
            ownerName: owners.name,
            ownerEmail: owners.email,
            ownerPhone: owners.phone,
            petName: owners.petName,
            clinicName: clinics.name,
          })
          .from(plans)
          .leftJoin(owners, eq(plans.ownerId, owners.id))
          .leftJoin(clinics, eq(plans.clinicId, clinics.id))
          .where(eq(plans.status, 'defaulted'))
          .orderBy(desc(plans.updatedAt))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db.select({ total: count() }).from(plans).where(eq(plans.status, 'defaulted')),
      ]);

      const totalCount = Number(countResult[0]?.total ?? 0);

      return {
        plans: defaultedRows,
        pagination: {
          limit: input.limit,
          offset: input.offset,
          totalCount,
        },
      };
    }),

  /**
   * Recent audit log entries across all entity types.
   * Used by the admin dashboard recent activity widget.
   */
  getRecentAuditLog: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(input.limit);
    }),

  // ── Soft Collection Management (Issue #36) ──────────────────────────

  /**
   * Paginated list of soft collections with plan/owner info.
   * Supports optional status filter.
   */
  getSoftCollections: adminProcedure
    .input(
      z.object({
        status: z
          .enum(['day_1_reminder', 'day_7_followup', 'day_14_final', 'completed', 'cancelled'])
          .optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.status) {
        conditions.push(eq(softCollections.stage, input.status));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, countResult] = await Promise.all([
        ctx.db
          .select({
            id: softCollections.id,
            planId: softCollections.planId,
            stage: softCollections.stage,
            startedAt: softCollections.startedAt,
            lastEscalatedAt: softCollections.lastEscalatedAt,
            nextEscalationAt: softCollections.nextEscalationAt,
            notes: softCollections.notes,
            createdAt: softCollections.createdAt,
            ownerName: owners.name,
            ownerEmail: owners.email,
            petName: owners.petName,
            clinicName: clinics.name,
            remainingCents: plans.remainingCents,
          })
          .from(softCollections)
          .leftJoin(plans, eq(softCollections.planId, plans.id))
          .leftJoin(owners, eq(plans.ownerId, owners.id))
          .leftJoin(clinics, eq(plans.clinicId, clinics.id))
          .where(whereClause)
          .orderBy(desc(softCollections.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db.select({ total: count() }).from(softCollections).where(whereClause),
      ]);

      const totalCount = Number(countResult[0]?.total ?? 0);

      return {
        collections: rows,
        pagination: {
          limit: input.limit,
          offset: input.offset,
          totalCount,
        },
      };
    }),

  /**
   * Cancel a soft collection with a reason.
   */
  cancelSoftCollection: adminProcedure
    .input(
      z.object({
        collectionId: z.string().uuid(),
        reason: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await cancelSoftCollection(input.collectionId, input.reason);

        // Audit the admin action
        await logAuditEvent({
          entityType: 'plan',
          entityId: result.planId,
          action: 'status_changed',
          oldValue: { softCollectionCancelledBy: 'admin' },
          newValue: { softCollectionStage: 'cancelled', reason: input.reason },
          actorType: 'admin',
          actorId: ctx.session.userId,
        });

        return result;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to cancel soft collection',
        });
      }
    }),

  /**
   * Get soft collection statistics: count by stage and recovery rate.
   */
  getSoftCollectionStats: adminProcedure.query(async ({ ctx }) => {
    const stageCounts = await ctx.db
      .select({
        stage: softCollections.stage,
        count: sql<number>`count(*)`,
      })
      .from(softCollections)
      .groupBy(softCollections.stage);

    const stageMap: Record<string, number> = {};
    let totalCollections = 0;
    let completedCount = 0;
    let cancelledCount = 0;

    for (const row of stageCounts) {
      const cnt = Number(row.count);
      stageMap[row.stage] = cnt;
      totalCollections += cnt;
      if (row.stage === 'completed') completedCount = cnt;
      if (row.stage === 'cancelled') cancelledCount = cnt;
    }

    // Recovery rate = cancelled (owner paid) / total completed workflow
    const resolvedCount = completedCount + cancelledCount;
    const recoveryRate = resolvedCount > 0 ? (cancelledCount / resolvedCount) * 100 : 0;

    return {
      totalCollections,
      byStage: {
        day_1_reminder: stageMap.day_1_reminder ?? 0,
        day_7_followup: stageMap.day_7_followup ?? 0,
        day_14_final: stageMap.day_14_final ?? 0,
        completed: completedCount,
        cancelled: cancelledCount,
      },
      recoveryRate: Math.round(recoveryRate * 100) / 100,
    };
  }),
});
