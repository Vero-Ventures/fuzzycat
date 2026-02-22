import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { getNextLikelyPaydayAfterDays } from '@/lib/utils/payday';
import { db } from '@/server/db';
import { payments, plans, riskPool } from '@/server/db/schema';
import { logAuditEvent } from '@/server/services/audit';

/** Maximum number of retry attempts before escalating to default. */
const MAX_RETRIES = 3;

/** Urgency level for escalating notifications on retry attempts. */
export type UrgencyLevel = 1 | 2 | 3;

/**
 * Find all installment payments scheduled for today (or earlier) that are
 * still in pending status. These are payments ready to be collected.
 *
 * Returns payment records with plan information needed for processing.
 */
export async function identifyDuePayments(): Promise<
  {
    id: string;
    planId: string | null;
    amountCents: number;
    scheduledAt: Date;
    sequenceNum: number | null;
  }[]
> {
  const now = new Date();

  const duePayments = await db
    .select({
      id: payments.id,
      planId: payments.planId,
      amountCents: payments.amountCents,
      scheduledAt: payments.scheduledAt,
      sequenceNum: payments.sequenceNum,
    })
    .from(payments)
    .where(
      and(
        eq(payments.type, 'installment'),
        eq(payments.status, 'pending'),
        lte(payments.scheduledAt, now),
      ),
    );

  logger.info('Identified due payments', { count: duePayments.length });

  return duePayments;
}

/**
 * Retry a failed payment using smart payday-aligned scheduling.
 * Increments the retry count and sets status to 'retried' so it can be
 * picked up by the installment processor. Schedules the next retry on the
 * next likely payday (Friday, 1st, or 15th) at least 2 days out.
 *
 * Sends escalating notifications based on retry count:
 * - Retry 1: Friendly reminder (urgency level 1)
 * - Retry 2: Urgent notice with consequences (urgency level 2)
 * - Retry 3: Final notice before default (urgency level 3)
 *
 * If the payment has already reached MAX_RETRIES, this function will
 * not retry and instead returns false.
 */
export async function retryFailedPayment(paymentId: string): Promise<boolean> {
  return await db.transaction(async (tx) => {
    const [payment] = await tx
      .select({
        id: payments.id,
        status: payments.status,
        retryCount: payments.retryCount,
        planId: payments.planId,
        amountCents: payments.amountCents,
      })
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    if (payment.status !== 'failed') {
      logger.warn('Cannot retry payment that is not in failed status', {
        paymentId,
        status: payment.status,
      });
      return false;
    }

    const currentRetryCount = payment.retryCount ?? 0;

    if (currentRetryCount >= MAX_RETRIES) {
      logger.warn('Payment has exhausted all retries', {
        paymentId,
        retryCount: currentRetryCount,
      });
      return false;
    }

    const oldStatus = payment.status;
    const now = new Date();
    const nextRetryDate = getNextLikelyPaydayAfterDays(now, 2);
    const newRetryCount = currentRetryCount + 1;
    const urgencyLevel = newRetryCount as UrgencyLevel;

    await tx
      .update(payments)
      .set({
        status: 'retried',
        retryCount: newRetryCount,
        scheduledAt: nextRetryDate,
        failureReason: null,
      })
      .where(eq(payments.id, paymentId));

    await logAuditEvent(
      {
        entityType: 'payment',
        entityId: paymentId,
        action: 'retried',
        oldValue: { status: oldStatus, retryCount: currentRetryCount },
        newValue: {
          status: 'retried',
          retryCount: newRetryCount,
          scheduledAt: nextRetryDate.toISOString(),
          urgencyLevel,
        },
        actorType: 'system',
      },
      tx,
    );

    logger.info('Payment scheduled for retry on next likely payday', {
      paymentId,
      retryCount: newRetryCount,
      urgencyLevel,
      nextRetryDate: nextRetryDate.toISOString(),
    });

    return true;
  });
}

/**
 * Escalate a plan to defaulted status after a payment has exhausted all retries.
 * Marks the plan as 'defaulted' and creates a risk pool claim for the
 * remaining unpaid balance to guarantee clinic payment.
 *
 * All operations run inside a transaction.
 */
export async function escalateDefault(planId: string): Promise<void> {
  await db.transaction(async (tx) => {
    // Fetch current plan state
    const [plan] = await tx
      .select({
        id: plans.id,
        status: plans.status,
        remainingCents: plans.remainingCents,
        clinicId: plans.clinicId,
      })
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1);

    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    if (plan.status === 'defaulted') {
      logger.warn('Plan already defaulted, skipping', { planId });
      return;
    }

    if (plan.status !== 'active') {
      throw new Error(`Cannot default plan in status: ${plan.status}`);
    }

    const oldStatus = plan.status;

    // Calculate remaining unpaid amount from pending/failed/retried payments
    const unpaidPayments = await tx
      .select({
        totalUnpaidCents: sql<number>`coalesce(sum(${payments.amountCents}), 0)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.planId, planId),
          inArray(payments.status, ['pending', 'failed', 'retried', 'written_off']),
        ),
      );

    const unpaidCents = unpaidPayments[0]?.totalUnpaidCents ?? 0;

    // Mark plan as defaulted
    await tx.update(plans).set({ status: 'defaulted' }).where(eq(plans.id, planId));

    // Audit log for plan default
    await logAuditEvent(
      {
        entityType: 'plan',
        entityId: planId,
        action: 'status_changed',
        oldValue: { status: oldStatus },
        newValue: { status: 'defaulted', unpaidCents },
        actorType: 'system',
      },
      tx,
    );

    // Create risk pool claim if there's unpaid balance
    if (unpaidCents > 0) {
      await tx.insert(riskPool).values({
        planId,
        contributionCents: unpaidCents,
        type: 'claim',
      });

      await logAuditEvent(
        {
          entityType: 'risk_pool',
          entityId: planId,
          action: 'claim_created',
          newValue: {
            claimAmountCents: unpaidCents,
            clinicId: plan.clinicId,
          },
          actorType: 'system',
        },
        tx,
      );

      logger.info('Risk pool claim created for defaulted plan', {
        planId,
        unpaidCents,
        clinicId: plan.clinicId,
      });
    }

    // Mark remaining unpaid payments as written_off
    await tx
      .update(payments)
      .set({ status: 'written_off' })
      .where(
        and(
          eq(payments.planId, planId),
          inArray(payments.status, ['pending', 'failed', 'retried']),
        ),
      );

    await logAuditEvent(
      {
        entityType: 'plan',
        entityId: planId,
        action: 'payments_written_off',
        newValue: { unpaidCents },
        actorType: 'system',
      },
      tx,
    );

    logger.info('Plan escalated to defaulted', { planId, unpaidCents });
  });
}

/**
 * Identify payments that have been in 'written_off' status where the
 * associated plan should be escalated to default.
 * Finds plans that have at least one written_off payment and are still active.
 */
export async function identifyPlansForEscalation(): Promise<string[]> {
  const result = await db
    .select({ planId: payments.planId })
    .from(payments)
    .where(eq(payments.status, 'written_off'))
    .groupBy(payments.planId);

  const planIds: string[] = [];
  for (const row of result) {
    if (!row.planId) continue;

    // Check if plan is still active
    const [plan] = await db
      .select({ status: plans.status })
      .from(plans)
      .where(eq(plans.id, row.planId))
      .limit(1);

    if (plan?.status === 'active') {
      planIds.push(row.planId);
    }
  }

  return planIds;
}

/**
 * Calculate the retry success rate from historical payment data.
 * Queries for all payments that have been retried (retryCount > 0)
 * and checks how many eventually succeeded.
 *
 * @returns Object with total retried payments, succeeded count, and rate (0-1)
 */
export async function getRetrySuccessRate(): Promise<{
  total: number;
  succeeded: number;
  rate: number;
}> {
  const [retriedResult] = await db
    .select({
      total: sql<number>`count(*)::int`,
    })
    .from(payments)
    .where(sql`${payments.retryCount} > 0`);

  const total = retriedResult?.total ?? 0;

  const [succeededResult] = await db
    .select({
      succeeded: sql<number>`count(*)::int`,
    })
    .from(payments)
    .where(and(sql`${payments.retryCount} > 0`, eq(payments.status, 'succeeded')));

  const succeeded = succeededResult?.succeeded ?? 0;

  const rate = total > 0 ? succeeded / total : 0;

  logger.info('Retry success rate calculated', { total, succeeded, rate });

  return { total, succeeded, rate };
}
