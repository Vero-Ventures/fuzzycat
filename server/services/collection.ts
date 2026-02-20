import { and, eq, lte, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { db } from '@/server/db';
import { auditLog, payments, plans, riskPool } from '@/server/db/schema';

/** Maximum number of retry attempts before escalating to default. */
const MAX_RETRIES = 3;

/** Number of days between retry attempts. */
const RETRY_INTERVAL_DAYS = 3;

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
 * Retry a failed payment. Increments the retry count and sets status
 * to 'retried' so it can be picked up by the installment processor.
 * Schedules the next retry attempt RETRY_INTERVAL_DAYS in the future.
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
    const nextRetryDate = new Date();
    nextRetryDate.setDate(nextRetryDate.getDate() + RETRY_INTERVAL_DAYS);

    await tx
      .update(payments)
      .set({
        status: 'retried',
        retryCount: currentRetryCount + 1,
        scheduledAt: nextRetryDate,
        failureReason: null,
      })
      .where(eq(payments.id, paymentId));

    await tx.insert(auditLog).values({
      entityType: 'payment',
      entityId: paymentId,
      action: 'retried',
      oldValue: JSON.stringify({ status: oldStatus, retryCount: currentRetryCount }),
      newValue: JSON.stringify({
        status: 'retried',
        retryCount: currentRetryCount + 1,
        scheduledAt: nextRetryDate.toISOString(),
      }),
      actorType: 'system',
    });

    logger.info('Payment scheduled for retry', {
      paymentId,
      retryCount: currentRetryCount + 1,
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
          sql`${payments.status} in ('pending', 'failed', 'retried', 'written_off')`,
        ),
      );

    const unpaidCents = unpaidPayments[0]?.totalUnpaidCents ?? 0;

    // Mark plan as defaulted
    await tx.update(plans).set({ status: 'defaulted' }).where(eq(plans.id, planId));

    // Audit log for plan default
    await tx.insert(auditLog).values({
      entityType: 'plan',
      entityId: planId,
      action: 'status_changed',
      oldValue: JSON.stringify({ status: oldStatus }),
      newValue: JSON.stringify({ status: 'defaulted', unpaidCents }),
      actorType: 'system',
    });

    // Create risk pool claim if there's unpaid balance
    if (unpaidCents > 0) {
      await tx.insert(riskPool).values({
        planId,
        contributionCents: unpaidCents,
        type: 'claim',
      });

      await tx.insert(auditLog).values({
        entityType: 'risk_pool',
        entityId: planId,
        action: 'claim_created',
        newValue: JSON.stringify({
          claimAmountCents: unpaidCents,
          clinicId: plan.clinicId,
        }),
        actorType: 'system',
      });

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
          sql`${payments.status} in ('pending', 'failed', 'retried')`,
        ),
      );

    await tx.insert(auditLog).values({
      entityType: 'plan',
      entityId: planId,
      action: 'payments_written_off',
      newValue: JSON.stringify({ unpaidCents }),
      actorType: 'system',
    });

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
