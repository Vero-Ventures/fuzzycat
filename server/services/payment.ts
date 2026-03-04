import { and, eq } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import { PLATFORM_RESERVE_RATE } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { stripe } from '@/lib/stripe';
import { percentOfCents } from '@/lib/utils/money';
import { db } from '@/server/db';
import { clinics, owners, payments, payouts, plans, riskPool } from '@/server/db/schema';
import { logAuditEvent } from '@/server/services/audit';
import {
  calculateApplicationFee,
  calculatePayoutBreakdown,
  getEffectiveShareRate,
} from '@/server/services/payout';
import { createInstallmentPaymentIntent } from '@/server/services/stripe/ach';
import { createDepositCheckoutSession } from '@/server/services/stripe/checkout';
import { getOrCreateCustomer } from '@/server/services/stripe/customer';

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
  ownerId?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; sessionUrl: string }> {
  // Fetch plan with owner info for Stripe customer
  const [plan] = await db
    .select({
      id: plans.id,
      ownerId: plans.ownerId,
      clinicId: plans.clinicId,
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

  if (!plan.clinicId) {
    throw new Error(`Plan ${params.planId} has no clinic`);
  }

  // Fetch the clinic's Stripe Connect account and revenue share info
  const [clinic] = await db
    .select({
      stripeAccountId: clinics.stripeAccountId,
      revenueShareBps: clinics.revenueShareBps,
      foundingClinic: clinics.foundingClinic,
      foundingExpiresAt: clinics.foundingExpiresAt,
    })
    .from(clinics)
    .where(eq(clinics.id, plan.clinicId))
    .limit(1);

  if (!clinic?.stripeAccountId) {
    throw new Error(`Clinic for plan ${params.planId} does not have a Stripe Connect account`);
  }

  // Verify the caller owns this plan (IDOR protection)
  if (params.ownerId && plan.ownerId !== params.ownerId) {
    throw new Error('Not authorized to initiate deposit for this plan');
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

  // Fetch the owner's Stripe customer ID (lazy-create if missing)
  const [owner] = await db
    .select({
      stripeCustomerId: owners.stripeCustomerId,
      email: owners.email,
      name: owners.name,
    })
    .from(owners)
    .where(eq(owners.id, plan.ownerId))
    .limit(1);

  if (!owner) {
    throw new Error(`Owner ${plan.ownerId} not found`);
  }

  const stripeCustomerId =
    owner.stripeCustomerId ??
    (await getOrCreateCustomer({
      ownerId: plan.ownerId,
      email: owner.email,
      name: owner.name,
    }));

  const clinicShareRate = getEffectiveShareRate(clinic);

  return createDepositCheckoutSession({
    paymentId: depositPayment.id,
    planId: params.planId,
    stripeCustomerId,
    depositCents: plan.depositCents,
    successUrl: params.successUrl,
    cancelUrl: params.cancelUrl,
    clinicStripeAccountId: clinic.stripeAccountId,
    applicationFeeCents: calculateApplicationFee(plan.depositCents, clinicShareRate),
  });
}

/**
 * Validate that a Stripe payment method still exists and is usable.
 * Uses paymentMethods.retrieve for both card and ACH (us_bank_account) PMs.
 * Returns true if valid, false if the PM has been deleted or is invalid.
 */
async function validatePaymentMethod(params: {
  paymentMethodId: string;
  paymentMethodType: 'card' | 'us_bank_account';
  stripeCustomerId: string;
}): Promise<boolean> {
  try {
    const pm = await stripe().paymentMethods.retrieve(params.paymentMethodId);
    return pm.customer !== null;
  } catch (err) {
    logger.error('Payment method validation failed', {
      paymentMethodId: params.paymentMethodId,
      paymentMethodType: params.paymentMethodType,
      error: err,
    });
    return false;
  }
}

/**
 * Resolve which Stripe payment method and type to use for an installment charge.
 * An explicit override takes priority; otherwise the owner's saved preference is used.
 */
function resolvePaymentMethod(
  paymentId: string,
  explicitPaymentMethodId: string | undefined,
  owner: {
    paymentMethod: string | null;
    stripeCardPaymentMethodId: string | null;
    stripeAchPaymentMethodId: string | null;
  },
): { paymentMethodId?: string; paymentMethodType?: 'card' | 'us_bank_account' } {
  if (explicitPaymentMethodId) {
    return { paymentMethodId: explicitPaymentMethodId };
  }

  if (!owner.paymentMethod) {
    return {};
  }

  if (owner.paymentMethod === 'bank_account') {
    const id = owner.stripeAchPaymentMethodId ?? undefined;
    if (!id) {
      throw new Error(
        `Owner for payment ${paymentId} prefers bank_account but has no saved ACH payment method`,
      );
    }
    return { paymentMethodId: id, paymentMethodType: 'us_bank_account' };
  }

  if (owner.paymentMethod === 'debit_card') {
    const id = owner.stripeCardPaymentMethodId ?? undefined;
    if (!id) {
      throw new Error(
        `Owner for payment ${paymentId} prefers debit_card but has no saved card payment method`,
      );
    }
    return { paymentMethodId: id, paymentMethodType: 'card' };
  }

  return {};
}

/**
 * Initiate an installment charge for a specific payment via Stripe.
 * Looks up the payment record and associated owner, then creates a PaymentIntent.
 * Routes to the correct payment method type based on the owner's saved preference.
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

  // Fetch plan to get owner and clinic
  const [plan] = await db
    .select({ ownerId: plans.ownerId, clinicId: plans.clinicId, status: plans.status })
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

  if (!plan.clinicId) {
    throw new Error(`Plan for payment ${params.paymentId} has no clinic`);
  }

  // Fetch the clinic's Stripe Connect account and revenue share info
  const [clinic] = await db
    .select({
      stripeAccountId: clinics.stripeAccountId,
      revenueShareBps: clinics.revenueShareBps,
      foundingClinic: clinics.foundingClinic,
      foundingExpiresAt: clinics.foundingExpiresAt,
    })
    .from(clinics)
    .where(eq(clinics.id, plan.clinicId))
    .limit(1);

  if (!clinic?.stripeAccountId) {
    throw new Error(
      `Clinic for payment ${params.paymentId} does not have a Stripe Connect account`,
    );
  }

  // Fetch owner's Stripe customer ID and payment method preference
  const [owner] = await db
    .select({
      stripeCustomerId: owners.stripeCustomerId,
      paymentMethod: owners.paymentMethod,
      stripeCardPaymentMethodId: owners.stripeCardPaymentMethodId,
      stripeAchPaymentMethodId: owners.stripeAchPaymentMethodId,
    })
    .from(owners)
    .where(eq(owners.id, plan.ownerId))
    .limit(1);

  if (!owner?.stripeCustomerId) {
    throw new Error(`Owner for payment ${params.paymentId} has no Stripe customer ID`);
  }

  // Resolve the payment method: explicit override takes priority, then owner preference
  const resolved = resolvePaymentMethod(params.paymentId, params.paymentMethodId, owner);

  // Validate the payment method still exists in Stripe before charging
  if (resolved.paymentMethodId && resolved.paymentMethodType) {
    const isValid = await validatePaymentMethod({
      paymentMethodId: resolved.paymentMethodId,
      paymentMethodType: resolved.paymentMethodType,
      stripeCustomerId: owner.stripeCustomerId,
    });

    if (!isValid) {
      await handlePaymentFailure(
        params.paymentId,
        'Payment method is no longer valid. Please update your payment method.',
      );
      throw new Error(
        `Payment method ${resolved.paymentMethodId} is no longer valid for payment ${params.paymentId}`,
      );
    }
  }

  const clinicShareRate = getEffectiveShareRate(clinic);

  return createInstallmentPaymentIntent({
    paymentId: params.paymentId,
    planId: payment.planId,
    stripeCustomerId: owner.stripeCustomerId,
    amountCents: payment.amountCents,
    paymentMethodId: resolved.paymentMethodId,
    paymentMethodType: resolved.paymentMethodType,
    clinicStripeAccountId: clinic.stripeAccountId,
    applicationFeeCents: calculateApplicationFee(payment.amountCents, clinicShareRate),
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

async function saveCardPaymentMethod(
  tx: DrizzleTx,
  ownerId: string | null,
  stripePaymentMethodId: string | undefined,
  stripeCustomerId?: string | null,
): Promise<void> {
  if (!stripePaymentMethodId || !ownerId) return;

  await tx
    .update(owners)
    .set({ stripeCardPaymentMethodId: stripePaymentMethodId })
    .where(eq(owners.id, ownerId));

  if (stripeCustomerId) {
    try {
      await stripe().customers.update(stripeCustomerId, {
        invoice_settings: { default_payment_method: stripePaymentMethodId },
      });
    } catch (error) {
      logger.error('Failed to update Stripe customer default payment method', {
        ownerId,
        stripeCustomerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function recordRiskPoolContribution(
  tx: DrizzleTx,
  planId: string,
  amountCents: number,
): Promise<void> {
  const riskContributionCents = percentOfCents(amountCents, PLATFORM_RESERVE_RATE);

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

/**
 * Record a payout as already succeeded via Stripe destination charges.
 * With destination charges, Stripe atomically splits the payment at charge time,
 * so the clinic's share is already transferred — no background worker needed.
 */
async function recordDestinationPayout(
  tx: DrizzleTx,
  params: {
    clinicId: string;
    planId: string;
    paymentId: string;
    amountCents: number;
    clinicShareRate?: number;
  },
): Promise<void> {
  // Check for existing payout to avoid duplicates (idempotency)
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

  const breakdown = calculatePayoutBreakdown(params.amountCents, params.clinicShareRate);

  // Record as succeeded — Stripe already transferred the funds via destination charge
  const [payoutRecord] = await tx
    .insert(payouts)
    .values({
      clinicId: params.clinicId,
      planId: params.planId,
      paymentId: params.paymentId,
      amountCents: breakdown.transferAmountCents,
      clinicShareCents: breakdown.clinicShareCents,
      status: 'succeeded',
    })
    .returning();

  await logAuditEvent(
    {
      entityType: 'payout',
      entityId: payoutRecord.id,
      action: 'created',
      newValue: {
        amountCents: breakdown.transferAmountCents,
        clinicShareCents: breakdown.clinicShareCents,
        status: 'succeeded',
      },
      actorType: 'system',
    },
    tx,
  );
}

/**
 * Handle a successful payment. Updates the payment status to succeeded,
 * logs an audit entry, contributes to the risk pool, and records the
 * destination charge payout (Stripe already split funds at charge time).
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
  stripePaymentMethodId?: string,
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

    // Fetch plan + owner + clinic info for payout and card storage
    const [planRow] = await tx
      .select({
        id: plans.id,
        ownerId: plans.ownerId,
        clinicId: plans.clinicId,
        status: plans.status,
        totalBillCents: plans.totalBillCents,
        stripeCustomerId: owners.stripeCustomerId,
        revenueShareBps: clinics.revenueShareBps,
        foundingClinic: clinics.foundingClinic,
        foundingExpiresAt: clinics.foundingExpiresAt,
      })
      .from(plans)
      .leftJoin(owners, eq(plans.ownerId, owners.id))
      .leftJoin(clinics, eq(plans.clinicId, clinics.id))
      .where(eq(plans.id, payment.planId))
      .limit(1);

    if (!planRow?.clinicId) return;

    // Deposit payment: activate the plan and save card for future use
    if (payment.type === 'deposit') {
      await activatePlanForDeposit(tx, payment.planId, planRow.status);
      await saveCardPaymentMethod(
        tx,
        planRow.ownerId,
        stripePaymentMethodId,
        planRow.stripeCustomerId,
      );
    }

    // Installment payment: check if all payments are now succeeded -> complete plan
    if (payment.type === 'installment') {
      await completePlanIfAllPaid(tx, payment.planId, planRow.status);
    }

    // Risk pool contribution: 1% of payment amount
    await recordRiskPoolContribution(tx, payment.planId, payment.amountCents);

    // Record the destination charge payout as succeeded (Stripe already split the funds)
    const clinicShareRate = getEffectiveShareRate({
      revenueShareBps: planRow.revenueShareBps ?? 300,
      foundingClinic: planRow.foundingClinic ?? false,
      foundingExpiresAt: planRow.foundingExpiresAt,
    });
    await recordDestinationPayout(tx, {
      clinicId: planRow.clinicId,
      planId: payment.planId,
      paymentId: payment.id,
      amountCents: payment.amountCents,
      clinicShareRate,
    });
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
