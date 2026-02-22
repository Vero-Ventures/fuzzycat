import { and, eq } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import { CLINIC_SHARE_RATE, PLATFORM_FEE_RATE, RISK_POOL_RATE } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { percentOfCents } from '@/lib/utils/money';
import { db } from '@/server/db';
import { clinics, owners, payments, payouts, plans, riskPool } from '@/server/db/schema';
import { logAuditEvent } from '@/server/services/audit';
import { createInstallmentPaymentIntent } from '@/server/services/stripe/ach';
import { createDepositCheckoutSession } from '@/server/services/stripe/checkout';

// biome-ignore lint/suspicious/noExplicitAny: Drizzle transaction types are complex generics that vary by driver; using `any` here avoids coupling to a specific driver implementation.
type DrizzleTx = PgTransaction<any, any, any>;

/** Maximum number of retry attempts for a failed payment. */
const MAX_RETRIES = 3;

/**
 * Initiate a deposit charge for a plan via Stripe Checkout (debit card).
 * Looks up the plan and its deposit payment record, then delegates to the
 * Stripe checkout session creator.
 */
export async function processDeposit(params: {
  planId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; sessionUrl: string }> {
  // Fetch plan with owner info for Stripe customer
  const [plan] = await db
    .select({
      id: plans.id,
      ownerId: plans.ownerId,
      depositCents: plans.depositCents,
      status: plans.status,
    })
    .from(plans)
    .where(eq(plans.id, params.planId))
    .limit(1);

  if (!plan) {
    throw new Error(`Plan not found: ${params.planId}`);
  }

  if (plan.status !== 'pending') {
    throw new Error(`Plan ${params.planId} is not in pending status (current: ${plan.status})`);
  }

  if (!plan.ownerId) {
    throw new Error(`Plan ${params.planId} has no owner`);
  }

  // Fetch the deposit payment record
  const [depositPayment] = await db
    .select({ id: payments.id, status: payments.status })
    .from(payments)
    .where(and(eq(payments.planId, params.planId), eq(payments.type, 'deposit')))
    .limit(1);

  if (!depositPayment) {
    throw new Error(`Deposit payment not found for plan: ${params.planId}`);
  }

  if (depositPayment.status !== 'pending') {
    throw new Error(
      `Deposit payment ${depositPayment.id} is not pending (current: ${depositPayment.status})`,
    );
  }

  // Fetch the owner's Stripe customer ID
  const [owner] = await db
    .select({
      stripeCustomerId: owners.stripeCustomerId,
    })
    .from(owners)
    .where(eq(owners.id, plan.ownerId))
    .limit(1);

  if (!owner?.stripeCustomerId) {
    throw new Error(`Owner ${plan.ownerId} does not have a Stripe customer ID`);
  }

  return createDepositCheckoutSession({
    paymentId: depositPayment.id,
    planId: params.planId,
    stripeCustomerId: owner.stripeCustomerId,
    depositCents: plan.depositCents,
    successUrl: params.successUrl,
    cancelUrl: params.cancelUrl,
  });
}

/**
 * Initiate an ACH installment charge for a specific payment via Stripe.
 * Looks up the payment record and associated owner, then creates a PaymentIntent.
 */
export async function processInstallment(params: {
  paymentId: string;
  paymentMethodId?: string;
}): Promise<{ paymentIntentId: string; clientSecret: string; status: string }> {
  // Fetch payment with plan info
  const [payment] = await db
    .select({
      id: payments.id,
      planId: payments.planId,
      amountCents: payments.amountCents,
      status: payments.status,
      type: payments.type,
    })
    .from(payments)
    .where(eq(payments.id, params.paymentId))
    .limit(1);

  if (!payment) {
    throw new Error(`Payment not found: ${params.paymentId}`);
  }

  if (payment.type !== 'installment') {
    throw new Error(`Payment ${params.paymentId} is not an installment (type: ${payment.type})`);
  }

  if (payment.status !== 'pending' && payment.status !== 'retried') {
    throw new Error(
      `Payment ${params.paymentId} cannot be processed (current status: ${payment.status})`,
    );
  }

  if (!payment.planId) {
    throw new Error(`Payment ${params.paymentId} has no associated plan`);
  }

  // Fetch plan to get owner
  const [plan] = await db
    .select({ ownerId: plans.ownerId, status: plans.status })
    .from(plans)
    .where(eq(plans.id, payment.planId))
    .limit(1);

  if (!plan) {
    throw new Error(`Plan not found for payment: ${params.paymentId}`);
  }

  if (plan.status !== 'active') {
    throw new Error(`Plan for payment ${params.paymentId} is not active (status: ${plan.status})`);
  }

  if (!plan.ownerId) {
    throw new Error(`Plan for payment ${params.paymentId} has no owner`);
  }

  // Fetch owner's Stripe customer ID
  const [owner] = await db
    .select({ stripeCustomerId: owners.stripeCustomerId })
    .from(owners)
    .where(eq(owners.id, plan.ownerId))
    .limit(1);

  if (!owner?.stripeCustomerId) {
    throw new Error(`Owner for payment ${params.paymentId} has no Stripe customer ID`);
  }

  return createInstallmentPaymentIntent({
    paymentId: params.paymentId,
    planId: payment.planId,
    stripeCustomerId: owner.stripeCustomerId,
    amountCents: payment.amountCents,
    paymentMethodId: params.paymentMethodId,
  });
}

async function activatePlanForDeposit(
  tx: DrizzleTx,
  planId: string,
  currentStatus: string,
): Promise<void> {
  if (currentStatus !== 'pending' && currentStatus !== 'deposit_paid') return;

  await tx
    .update(plans)
    .set({ status: 'active', depositPaidAt: new Date() })
    .where(eq(plans.id, planId));

  await logAuditEvent(
    {
      entityType: 'plan',
      entityId: planId,
      action: 'status_changed',
      oldValue: { status: currentStatus },
      newValue: { status: 'active' },
      actorType: 'system',
    },
    tx,
  );
}

async function completePlanIfAllPaid(
  tx: DrizzleTx,
  planId: string,
  currentStatus: string,
): Promise<void> {
  if (currentStatus === 'completed') return;

  // 7 = 1 deposit + 6 installments (max payments per plan)
  const planPayments = await tx
    .select({ status: payments.status })
    .from(payments)
    .where(eq(payments.planId, planId))
    .limit(7);

  const allSucceeded = planPayments.every((p) => p.status === 'succeeded');
  if (!allSucceeded) return;

  await tx
    .update(plans)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(plans.id, planId));

  await logAuditEvent(
    {
      entityType: 'plan',
      entityId: planId,
      action: 'status_changed',
      oldValue: { status: currentStatus },
      newValue: { status: 'completed' },
      actorType: 'system',
    },
    tx,
  );
}

async function recordRiskPoolContribution(
  tx: DrizzleTx,
  planId: string,
  amountCents: number,
): Promise<void> {
  const riskContributionCents = percentOfCents(amountCents, RISK_POOL_RATE);

  await tx.insert(riskPool).values({
    planId: planId,
    contributionCents: riskContributionCents,
    type: 'contribution',
  });

  await logAuditEvent(
    {
      entityType: 'risk_pool',
      entityId: planId,
      action: 'contribution',
      newValue: { contributionCents: riskContributionCents },
      actorType: 'system',
    },
    tx,
  );
}

async function createPendingPayout(
  tx: DrizzleTx,
  params: {
    clinicId: string;
    planId: string;
    paymentId: string;
    amountCents: number;
  },
): Promise<void> {
  // Check for existing payout to avoid duplicates
  const existingPayout = await tx
    .select({ id: payouts.id })
    .from(payouts)
    .where(eq(payouts.paymentId, params.paymentId))
    .limit(1);

  if (existingPayout.length > 0) {
    logger.warn('Payout already exists for payment, skipping creation', {
      paymentId: params.paymentId,
      payoutId: existingPayout[0].id,
    });
    return;
  }

  // Calculate transfer amount: payment amount minus platform fee portion minus risk pool
  const riskContributionCents = percentOfCents(params.amountCents, RISK_POOL_RATE);
  const platformRetainedCents = percentOfCents(params.amountCents, PLATFORM_FEE_RATE / 2);
  const transferAmountCents = params.amountCents - platformRetainedCents - riskContributionCents;
  const clinicShareCents = percentOfCents(params.amountCents, CLINIC_SHARE_RATE);

  if (transferAmountCents <= 0) {
    logger.warn('Transfer amount is zero or negative, skipping payout', {
      paymentId: params.paymentId,
      transferAmountCents,
    });
    return;
  }

  // Create a pending payout record for the background worker to process
  const [payoutRecord] = await tx
    .insert(payouts)
    .values({
      clinicId: params.clinicId,
      planId: params.planId,
      paymentId: params.paymentId,
      amountCents: transferAmountCents,
      clinicShareCents,
      status: 'pending',
    })
    .returning();

  await logAuditEvent(
    {
      entityType: 'payout',
      entityId: payoutRecord.id,
      action: 'created',
      newValue: {
        amountCents: transferAmountCents,
        clinicShareCents,
        status: 'pending',
      },
      actorType: 'system',
    },
    tx,
  );
}

/**
 * Handle a successful payment. Updates the payment status to succeeded,
 * logs an audit entry, contributes to the risk pool, and triggers a payout
 * to the clinic via Stripe Connect.
 *
 * For deposit payments, also activates the plan.
 * For installment payments, checks if all payments are now succeeded and
 * completes the plan if so.
 *
 * All database operations run inside a transaction.
 */
export async function handlePaymentSuccess(
  paymentId: string,
  stripePaymentIntentId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    // Fetch current payment state
    const [payment] = await tx
      .select({
        id: payments.id,
        planId: payments.planId,
        amountCents: payments.amountCents,
        status: payments.status,
        type: payments.type,
      })
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    if (payment.status === 'succeeded') {
      logger.warn('Payment already succeeded, skipping', { paymentId });
      return;
    }

    const oldStatus = payment.status;

    // Update payment status
    await tx
      .update(payments)
      .set({
        status: 'succeeded',
        stripePaymentIntentId,
        processedAt: new Date(),
      })
      .where(eq(payments.id, paymentId));

    // Audit log for payment success
    await logAuditEvent(
      {
        entityType: 'payment',
        entityId: paymentId,
        action: 'status_changed',
        oldValue: { status: oldStatus },
        newValue: { status: 'succeeded' },
        actorType: 'system',
      },
      tx,
    );

    if (!payment.planId) return;

    // Fetch plan + clinic info for payout
    const [plan] = await tx
      .select({
        id: plans.id,
        clinicId: plans.clinicId,
        status: plans.status,
        totalBillCents: plans.totalBillCents,
      })
      .from(plans)
      .where(eq(plans.id, payment.planId))
      .limit(1);

    if (!plan?.clinicId) return;

    // Deposit payment: activate the plan
    if (payment.type === 'deposit') {
      await activatePlanForDeposit(tx, payment.planId, plan.status);
    }

    // Installment payment: check if all payments are now succeeded -> complete plan
    if (payment.type === 'installment') {
      await completePlanIfAllPaid(tx, payment.planId, plan.status);
    }

    // Risk pool contribution: 1% of payment amount
    await recordRiskPoolContribution(tx, payment.planId, payment.amountCents);

    // Create a pending payout record for the background worker to process
    await createPendingPayout(tx, {
      clinicId: plan.clinicId,
      planId: payment.planId,
      paymentId: payment.id,
      amountCents: payment.amountCents,
    });
  });
}

/**
 * Trigger the actual Stripe Connect payout to a clinic for a succeeded payment.
 * This is separated from handlePaymentSuccess to avoid holding a DB transaction
 * open during external Stripe API calls.
 *
 * @deprecated Use the automated payout worker (processPendingPayouts) instead.
 * handlePaymentSuccess now creates pending payout records that the worker processes.
 */
export async function triggerPayout(paymentId: string): Promise<void> {
  const { transferToClinic } = await import('@/server/services/stripe/connect');

  const [payment] = await db
    .select({
      id: payments.id,
      planId: payments.planId,
      amountCents: payments.amountCents,
      status: payments.status,
    })
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);

  if (!payment || payment.status !== 'succeeded') {
    logger.warn('Cannot trigger payout for non-succeeded payment', { paymentId });
    return;
  }

  if (!payment.planId) return;

  const [plan] = await db
    .select({ clinicId: plans.clinicId })
    .from(plans)
    .where(eq(plans.id, payment.planId))
    .limit(1);

  if (!plan?.clinicId) return;

  const [clinic] = await db
    .select({ stripeAccountId: clinics.stripeAccountId })
    .from(clinics)
    .where(eq(clinics.id, plan.clinicId))
    .limit(1);

  if (!clinic?.stripeAccountId) {
    logger.warn('Clinic has no Stripe Connect account for payout', {
      clinicId: plan.clinicId,
      paymentId,
    });
    return;
  }

  const riskContributionCents = percentOfCents(payment.amountCents, RISK_POOL_RATE);
  const platformRetainedCents = percentOfCents(payment.amountCents, PLATFORM_FEE_RATE / 2);
  const transferAmountCents = payment.amountCents - platformRetainedCents - riskContributionCents;

  if (transferAmountCents <= 0) {
    logger.warn('Transfer amount is zero or negative, skipping payout', {
      paymentId,
      transferAmountCents,
    });
    return;
  }

  await transferToClinic({
    paymentId,
    planId: payment.planId,
    clinicId: plan.clinicId,
    clinicStripeAccountId: clinic.stripeAccountId,
    transferAmountCents,
  });
}

/**
 * Handle a failed payment. Updates the payment status to failed,
 * records the failure reason, and logs an audit entry.
 * If the payment has exceeded MAX_RETRIES, it will NOT be retried again.
 */
export async function handlePaymentFailure(paymentId: string, reason: string): Promise<void> {
  await db.transaction(async (tx) => {
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

    if (payment.status === 'failed' || payment.status === 'written_off') {
      logger.warn('Payment already in terminal failure state, skipping', {
        paymentId,
        status: payment.status,
      });
      return;
    }

    const oldStatus = payment.status;
    const currentRetryCount = payment.retryCount ?? 0;
    const isMaxRetries = currentRetryCount >= MAX_RETRIES;

    await tx
      .update(payments)
      .set({
        status: isMaxRetries ? 'written_off' : 'failed',
        failureReason: reason,
      })
      .where(eq(payments.id, paymentId));

    await logAuditEvent(
      {
        entityType: 'payment',
        entityId: paymentId,
        action: 'status_changed',
        oldValue: { status: oldStatus },
        newValue: {
          status: isMaxRetries ? 'written_off' : 'failed',
          failureReason: reason,
          retryCount: currentRetryCount,
        },
        actorType: 'system',
      },
      tx,
    );

    if (isMaxRetries) {
      logger.warn('Payment exhausted retries, written off', {
        paymentId,
        retryCount: currentRetryCount,
        planId: payment.planId,
      });
    }
  });
}

/**
 * Look up a payment by its Stripe PaymentIntent ID.
 * Returns the internal payment ID and status, or null if not found.
 * Used by the webhook handler to resolve Stripe IDs to internal IDs.
 */
export async function findPaymentByStripeId(
  stripePaymentIntentId: string,
): Promise<{ id: string; status: string } | null> {
  const [payment] = await db
    .select({ id: payments.id, status: payments.status })
    .from(payments)
    .where(eq(payments.stripePaymentIntentId, stripePaymentIntentId))
    .limit(1);

  return payment ?? null;
}
