import { and, desc, eq, sql, sum } from 'drizzle-orm';
import {
  CLINIC_SHARE_RATE,
  DEFAULT_CLINIC_SHARE_BPS,
  PLATFORM_RESERVE_RATE,
} from '@/lib/constants';
import { percentOfCents } from '@/lib/utils/money';
import { db } from '@/server/db';
import { payouts } from '@/server/db/schema';
import { isFoundingClinicEnabled } from '@/server/services/founding-clinic';

// ── Types ────────────────────────────────────────────────────────────

export interface PayoutBreakdown {
  /** The original payment amount in cents. */
  paymentAmountCents: number;
  /** FuzzyCat platform fee retained from the payment, in cents. */
  platformFeeCents: number;
  /** Risk pool contribution deducted from the payment, in cents. */
  riskPoolCents: number;
  /** The clinic revenue share bonus (platform administration compensation), in cents. */
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
 * Validate that a payment amount is a positive finite number.
 */
function assertValidAmount(amountCents: number, label: string): void {
  if (amountCents <= 0 || !Number.isFinite(amountCents)) {
    throw new RangeError(`${label}: invalid payment amount ${amountCents}`);
  }
}

/**
 * Calculate the payout breakdown for a DEPOSIT payment.
 *
 * All platform fee extraction (entire 6%) and all clinic revenue share (entire 3%)
 * happen on the deposit. This front-loads FuzzyCat's revenue and the clinic's share,
 * reducing cash-flow risk from defaults on later installments.
 *
 * All arithmetic uses integer cents — no floating point.
 */
export function calculateDepositPayoutBreakdown(
  depositAmountCents: number,
  totalFeeCents: number,
  totalWithFeeCents: number,
  clinicShareRate = CLINIC_SHARE_RATE,
): PayoutBreakdown {
  assertValidAmount(depositAmountCents, 'calculateDepositPayoutBreakdown');

  // depositBillPortion = deposit minus the entire plan fee
  // This is safe because deposit (25% of bill × 1.06 = 0.265 × bill) always exceeds
  // the fee (6% of bill = 0.06 × bill) for all positive bills.
  const depositBillPortion = depositAmountCents - totalFeeCents;
  const riskPoolCents = percentOfCents(depositBillPortion, PLATFORM_RESERVE_RATE);
  const totalClinicShareCents = percentOfCents(totalWithFeeCents, clinicShareRate);
  const applicationFeeCents = totalFeeCents + riskPoolCents - totalClinicShareCents;
  const transferAmountCents = depositAmountCents - applicationFeeCents;

  return {
    paymentAmountCents: depositAmountCents,
    platformFeeCents: totalFeeCents,
    riskPoolCents,
    clinicShareCents: totalClinicShareCents,
    transferAmountCents,
  };
}

/**
 * Calculate the payout breakdown for an INSTALLMENT payment.
 *
 * Installments have no platform fee and no clinic share — only the 1% risk pool
 * is deducted. The full installment amount is treated as bill (no fee component).
 *
 * All arithmetic uses integer cents — no floating point.
 */
export function calculateInstallmentPayoutBreakdown(
  installmentAmountCents: number,
): PayoutBreakdown {
  assertValidAmount(installmentAmountCents, 'calculateInstallmentPayoutBreakdown');

  const riskPoolCents = percentOfCents(installmentAmountCents, PLATFORM_RESERVE_RATE);
  const applicationFeeCents = riskPoolCents;
  const transferAmountCents = installmentAmountCents - applicationFeeCents;

  return {
    paymentAmountCents: installmentAmountCents,
    platformFeeCents: 0,
    riskPoolCents,
    clinicShareCents: 0,
    transferAmountCents,
  };
}

/**
 * Calculate the application_fee_amount for a deposit Stripe destination charge.
 * This is the amount FuzzyCat retains when Stripe atomically splits the payment.
 *
 * applicationFee = totalPlatformFee + riskPool - totalClinicShare
 */
export function calculateDepositApplicationFee(
  depositAmountCents: number,
  totalFeeCents: number,
  totalWithFeeCents: number,
  clinicShareRate = CLINIC_SHARE_RATE,
): number {
  const breakdown = calculateDepositPayoutBreakdown(
    depositAmountCents,
    totalFeeCents,
    totalWithFeeCents,
    clinicShareRate,
  );
  return depositAmountCents - breakdown.transferAmountCents;
}

/**
 * Calculate the application_fee_amount for an installment Stripe destination charge.
 * For installments, this is simply the risk pool (1% of the payment).
 */
export function calculateInstallmentApplicationFee(installmentAmountCents: number): number {
  const breakdown = calculateInstallmentPayoutBreakdown(installmentAmountCents);
  return installmentAmountCents - breakdown.transferAmountCents;
}

// ── Revenue share resolution ────────────────────────────────────────

/**
 * Determine the effective revenue share rate for a clinic.
 * Founding clinics with an active (non-expired) enhanced period use their
 * stored `revenueShareBps`; everyone else falls back to the default 3%.
 */
export function getEffectiveShareRate(clinic: {
  revenueShareBps: number;
  foundingClinic: boolean;
  foundingExpiresAt: Date | null;
}): number {
  if (
    isFoundingClinicEnabled() &&
    clinic.foundingClinic &&
    clinic.foundingExpiresAt &&
    clinic.foundingExpiresAt > new Date()
  ) {
    return clinic.revenueShareBps / 10_000;
  }
  return DEFAULT_CLINIC_SHARE_BPS / 10_000;
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
