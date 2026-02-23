import { and, count, desc, eq, sum } from 'drizzle-orm';
import { CLINIC_SHARE_RATE, PLATFORM_FEE_RATE, PLATFORM_RESERVE_RATE } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { stripe } from '@/lib/stripe';
import { percentOfCents } from '@/lib/utils/money';
import { db } from '@/server/db';
import { auditLog, clinics, payments, payouts } from '@/server/db/schema';
import { transferToClinic } from '@/server/services/stripe/connect';

// ── Types ────────────────────────────────────────────────────────────

export interface PayoutBreakdown {
  /** The original payment amount in cents. */
  paymentAmountCents: number;
  /** FuzzyCat platform fee retained from the payment, in cents. */
  platformFeeCents: number;
  /** Risk pool contribution deducted from the payment, in cents. */
  riskPoolCents: number;
  /** The 3% clinic revenue share bonus (platform administration compensation), in cents. */
  clinicShareCents: number;
  /** Net amount transferred to the clinic's Stripe Connect account, in cents. */
  transferAmountCents: number;
}

export interface PayoutResult {
  payoutId: string;
  stripeTransferId: string;
  breakdown: PayoutBreakdown;
}

export interface ClinicPayoutSummary {
  id: string;
  planId: string | null;
  paymentId: string | null;
  amountCents: number;
  clinicShareCents: number;
  stripeTransferId: string | null;
  status: 'pending' | 'succeeded' | 'failed';
  createdAt: Date | null;
}

export interface ClinicEarnings {
  totalPayoutCents: number;
  totalClinicShareCents: number;
  pendingPayoutCents: number;
  completedPayoutCount: number;
}

export interface ProcessedPayoutResult {
  payoutId: string;
  status: 'succeeded' | 'failed';
  stripeTransferId?: string;
  error?: string;
}

export interface ProcessPendingPayoutsResult {
  processed: number;
  succeeded: number;
  failed: number;
  results: ProcessedPayoutResult[];
}

// ── Payout calculation ───────────────────────────────────────────────

/**
 * Calculate the payout breakdown for a given payment amount.
 *
 * The payment amount from the pet owner includes the 6% platform fee.
 * From each payment, FuzzyCat retains:
 *   - Platform fee portion (proportional share of the 6% fee)
 *   - Risk pool contribution (1% of the original bill portion)
 *
 * The clinic receives:
 *   - The original bill portion of the payment (minus risk pool)
 *   - Plus a 3% clinic share bonus (platform administration compensation)
 *
 * All arithmetic uses integer cents — no floating point.
 */
export function calculatePayoutBreakdown(paymentAmountCents: number): PayoutBreakdown {
  if (paymentAmountCents <= 0 || !Number.isFinite(paymentAmountCents)) {
    throw new RangeError(`calculatePayoutBreakdown: invalid payment amount ${paymentAmountCents}`);
  }

  // The payment amount includes the 6% fee. Reverse-calculate the original bill portion.
  // paymentAmount = billPortion + feePortion
  // paymentAmount = billPortion * (1 + PLATFORM_FEE_RATE)
  // billPortion = paymentAmount / (1 + PLATFORM_FEE_RATE)
  const billPortionCents = Math.round(paymentAmountCents / (1 + PLATFORM_FEE_RATE));
  const platformFeeCents = paymentAmountCents - billPortionCents;
  const riskPoolCents = percentOfCents(billPortionCents, PLATFORM_RESERVE_RATE);
  const clinicShareCents = percentOfCents(paymentAmountCents, CLINIC_SHARE_RATE);

  // Transfer = bill portion - risk pool + clinic share
  const transferAmountCents = billPortionCents - riskPoolCents + clinicShareCents;

  return {
    paymentAmountCents,
    platformFeeCents,
    riskPoolCents,
    clinicShareCents,
    transferAmountCents,
  };
}

// ── Core payout processing ───────────────────────────────────────────

/**
 * Process a clinic payout after a successful payment.
 *
 * This function:
 *   1. Validates the payment exists, is succeeded, and belongs to an active plan
 *   2. Verifies the clinic has a Stripe Connect account
 *   3. Checks that no duplicate payout exists for this payment
 *   4. Calculates the payout breakdown (platform fee, risk pool, clinic share)
 *   5. Initiates a Stripe Connect transfer to the clinic
 *   6. Logs all state changes to the audit trail
 *
 * All database operations run inside a transaction for atomicity.
 */
export async function processClinicPayout(paymentId: string): Promise<PayoutResult> {
  // ── Step 1: Load and validate the payment ──────────────────────────

  const payment = await db.query.payments.findFirst({
    where: eq(payments.id, paymentId),
    with: {
      plan: {
        with: {
          clinic: true,
        },
      },
    },
  });

  if (!payment) {
    throw new Error(`Payment not found: ${paymentId}`);
  }

  if (payment.status !== 'succeeded') {
    throw new Error(`Payment ${paymentId} is not succeeded (status: ${payment.status})`);
  }

  if (!payment.plan) {
    throw new Error(`Payment ${paymentId} has no associated plan`);
  }

  const plan = payment.plan;

  if (plan.status !== 'active' && plan.status !== 'deposit_paid') {
    throw new Error(`Plan ${plan.id} is not in a payable state (status: ${plan.status})`);
  }

  if (!plan.clinic) {
    throw new Error(`Plan ${plan.id} has no associated clinic`);
  }

  const clinic = plan.clinic;

  if (!clinic.stripeAccountId) {
    throw new Error(`Clinic ${clinic.id} does not have a Stripe Connect account`);
  }

  // ── Step 2: Check for duplicate payout ─────────────────────────────

  const existingPayout = await db.query.payouts.findFirst({
    where: eq(payouts.paymentId, paymentId),
  });

  if (existingPayout) {
    throw new Error(`Payout already exists for payment ${paymentId}: ${existingPayout.id}`);
  }

  // ── Step 3: Calculate breakdown ────────────────────────────────────

  const breakdown = calculatePayoutBreakdown(payment.amountCents);

  // ── Step 4: Execute transfer via Stripe Connect ────────────────────

  const { transferId, payoutRecord } = await transferToClinic({
    paymentId,
    planId: plan.id,
    clinicId: clinic.id,
    clinicStripeAccountId: clinic.stripeAccountId,
    transferAmountCents: breakdown.transferAmountCents,
  });

  return {
    payoutId: payoutRecord.id,
    stripeTransferId: transferId,
    breakdown,
  };
}

// ── Background worker ────────────────────────────────────────────────

interface PendingPayoutRow {
  id: string;
  clinicId: string | null;
  planId: string | null;
  paymentId: string | null;
  amountCents: number;
  clinicShareCents: number;
}

async function executeSinglePayout(payout: PendingPayoutRow): Promise<ProcessedPayoutResult> {
  if (!payout.clinicId) {
    throw new Error(`Payout ${payout.id} has no clinic ID`);
  }

  const [clinic] = await db
    .select({ stripeAccountId: clinics.stripeAccountId })
    .from(clinics)
    .where(eq(clinics.id, payout.clinicId))
    .limit(1);

  if (!clinic?.stripeAccountId) {
    throw new Error(`Clinic ${payout.clinicId} has no Stripe Connect account`);
  }

  const transfer = await stripe().transfers.create(
    {
      amount: payout.amountCents,
      currency: 'usd',
      destination: clinic.stripeAccountId,
      metadata: {
        payoutId: payout.id,
        clinicId: payout.clinicId,
        ...(payout.paymentId && { paymentId: payout.paymentId }),
        ...(payout.planId && { planId: payout.planId }),
      },
    },
    { idempotencyKey: `payout_${payout.id}` },
  );

  await db.transaction(async (tx) => {
    await tx
      .update(payouts)
      .set({ stripeTransferId: transfer.id, status: 'succeeded' })
      .where(eq(payouts.id, payout.id));

    await tx.insert(auditLog).values({
      entityType: 'payout',
      entityId: payout.id,
      action: 'status_changed',
      oldValue: JSON.stringify({ status: 'pending' }),
      newValue: JSON.stringify({ status: 'succeeded', stripeTransferId: transfer.id }),
      actorType: 'system',
    });
  });

  return { payoutId: payout.id, status: 'succeeded', stripeTransferId: transfer.id };
}

async function markPayoutFailed(payoutId: string, errorMessage: string): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await tx.update(payouts).set({ status: 'failed' }).where(eq(payouts.id, payoutId));

      await tx.insert(auditLog).values({
        entityType: 'payout',
        entityId: payoutId,
        action: 'status_changed',
        oldValue: JSON.stringify({ status: 'pending' }),
        newValue: JSON.stringify({ status: 'failed', error: errorMessage }),
        actorType: 'system',
      });
    });
  } catch (auditErr) {
    logger.error('Failed to update payout status after error', {
      payoutId,
      error: auditErr instanceof Error ? auditErr.message : String(auditErr),
    });
  }
}

/**
 * Process all pending payouts by initiating Stripe Connect transfers.
 *
 * For each pending payout:
 *   1. Looks up the clinic's Stripe Connect account
 *   2. Initiates a Stripe transfer with an idempotency key (payout ID)
 *   3. Updates the payout status to succeeded or failed
 *   4. Logs all state changes to the audit trail
 *
 * Each payout is processed independently — a failure in one does not
 * affect others. Uses Stripe idempotency keys to prevent duplicate transfers.
 */
export async function processPendingPayouts(): Promise<ProcessPendingPayoutsResult> {
  const pendingPayouts = await db
    .select({
      id: payouts.id,
      clinicId: payouts.clinicId,
      planId: payouts.planId,
      paymentId: payouts.paymentId,
      amountCents: payouts.amountCents,
      clinicShareCents: payouts.clinicShareCents,
    })
    .from(payouts)
    .where(eq(payouts.status, 'pending'));

  // Process payouts in batches of 5 to avoid Stripe rate limits and DB pool exhaustion
  const BATCH_SIZE = 5;
  const results: ProcessedPayoutResult[] = [];

  for (let i = 0; i < pendingPayouts.length; i += BATCH_SIZE) {
    const batch = pendingPayouts.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (payout): Promise<ProcessedPayoutResult> => {
        try {
          return await executeSinglePayout(payout);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          logger.error('Failed to process payout', {
            payoutId: payout.id,
            clinicId: payout.clinicId,
            error: errorMessage,
          });
          await markPayoutFailed(payout.id, errorMessage);
          return { payoutId: payout.id, status: 'failed', error: errorMessage };
        }
      }),
    );
    results.push(...batchResults);
  }

  const succeeded = results.filter((r) => r.status === 'succeeded').length;
  const failed = results.filter((r) => r.status === 'failed').length;

  logger.info('Pending payouts processing complete', {
    processed: results.length,
    succeeded,
    failed,
  });

  return { processed: results.length, succeeded, failed, results };
}

// ── Query functions ──────────────────────────────────────────────────

/**
 * Get paginated payout history for a specific clinic.
 */
export async function getClinicPayoutHistory(
  clinicId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<{ payouts: ClinicPayoutSummary[]; total: number }> {
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;

  const [payoutRows, countResult] = await Promise.all([
    db
      .select({
        id: payouts.id,
        planId: payouts.planId,
        paymentId: payouts.paymentId,
        amountCents: payouts.amountCents,
        clinicShareCents: payouts.clinicShareCents,
        stripeTransferId: payouts.stripeTransferId,
        status: payouts.status,
        createdAt: payouts.createdAt,
      })
      .from(payouts)
      .where(eq(payouts.clinicId, clinicId))
      .orderBy(desc(payouts.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(payouts).where(eq(payouts.clinicId, clinicId)),
  ]);

  return {
    payouts: payoutRows,
    total: countResult[0]?.total ?? 0,
  };
}

/**
 * Get aggregate earnings data for a clinic.
 */
export async function getClinicEarnings(clinicId: string): Promise<ClinicEarnings> {
  const [succeededResult, pendingResult, countResult] = await Promise.all([
    db
      .select({
        totalPayout: sum(payouts.amountCents),
        totalShare: sum(payouts.clinicShareCents),
      })
      .from(payouts)
      .where(and(eq(payouts.clinicId, clinicId), eq(payouts.status, 'succeeded'))),
    db
      .select({
        pendingPayout: sum(payouts.amountCents),
      })
      .from(payouts)
      .where(and(eq(payouts.clinicId, clinicId), eq(payouts.status, 'pending'))),
    db
      .select({ completedCount: count() })
      .from(payouts)
      .where(and(eq(payouts.clinicId, clinicId), eq(payouts.status, 'succeeded'))),
  ]);

  return {
    totalPayoutCents: Number(succeededResult[0]?.totalPayout ?? 0),
    totalClinicShareCents: Number(succeededResult[0]?.totalShare ?? 0),
    pendingPayoutCents: Number(pendingResult[0]?.pendingPayout ?? 0),
    completedPayoutCount: countResult[0]?.completedCount ?? 0,
  };
}
