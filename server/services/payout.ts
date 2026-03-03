import { and, desc, eq, sql, sum } from 'drizzle-orm';
import { CLINIC_SHARE_RATE, PLATFORM_FEE_RATE, PLATFORM_RESERVE_RATE } from '@/lib/constants';
import { percentOfCents } from '@/lib/utils/money';
import { db } from '@/server/db';
import { payouts } from '@/server/db/schema';

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

/**
 * Calculate the application_fee_amount for a Stripe destination charge.
 * This is the amount FuzzyCat retains when Stripe atomically splits the payment.
 *
 * applicationFee = paymentAmount - transferToClinic
 *                = platformFee + riskPool - clinicShare
 */
export function calculateApplicationFee(paymentAmountCents: number): number {
  const breakdown = calculatePayoutBreakdown(paymentAmountCents);
  return paymentAmountCents - breakdown.transferAmountCents;
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
    db.select({ total: sql<number>`count(*)` }).from(payouts).where(eq(payouts.clinicId, clinicId)),
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
      .select({ completedCount: sql<number>`count(*)` })
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
