// ── Risk pool / guarantee service ────────────────────────────────────
// Manages the FuzzyCat guarantee fund. The risk pool is funded by 1% of
// each enrollment and pays clinics when a pet owner defaults.
//
// Three operation types:
//   - contribution: 1% of transaction total at enrollment
//   - claim: pays out remaining balance to clinic on default
//   - recovery: returned funds from soft collection on defaulted plans
//
// NOTE: The `contributionCents` column in the risk_pool table is reused
// for all three entry types (contributions, claims, and recoveries).
// This is a known naming issue — the column would be better named
// `amountCents` to reflect its general purpose. A schema migration to
// rename it is deferred to a future PR to avoid unnecessary risk here.

import { count, eq, sql } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import { RISK_POOL_RATE } from '@/lib/constants';
import { percentOfCents } from '@/lib/utils/money';
import { db } from '@/server/db';
import { plans, riskPool } from '@/server/db/schema';
import { logAuditEvent } from '@/server/services/audit';

// biome-ignore lint/suspicious/noExplicitAny: Drizzle transaction types are complex generics that vary by driver; using `any` here avoids coupling to a specific driver implementation.
type DrizzleTx = PgTransaction<any, any, any>;

// ── Types ─────────────────────────────────────────────────────────────

export type RiskPoolEntryType = 'contribution' | 'claim' | 'recovery';

export interface RiskPoolBalance {
  /** Total cents contributed to the pool across all plans. */
  totalContributionsCents: number;
  /** Total cents claimed from the pool across all defaulted plans. */
  totalClaimsCents: number;
  /** Total cents recovered from soft collection on defaulted plans. */
  totalRecoveriesCents: number;
  /** Net balance: contributions + recoveries - claims. */
  balanceCents: number;
}

export interface RiskPoolHealth {
  /** Current pool balance in cents. */
  balanceCents: number;
  /** Total outstanding guarantee exposure (remaining cents on active plans). */
  outstandingGuaranteesCents: number;
  /** Ratio of pool balance to outstanding guarantees (>1.0 = fully funded). */
  coverageRatio: number;
  /** Number of active plans currently covered by the pool. */
  activePlanCount: number;
}

// ── Contributions ─────────────────────────────────────────────────────

/**
 * Calculate the risk pool contribution for a given bill amount.
 * Uses RISK_POOL_RATE (1%) from constants.
 */
export function calculateContribution(totalWithFeeCents: number): number {
  return percentOfCents(totalWithFeeCents, RISK_POOL_RATE);
}

/**
 * Record a contribution to the risk pool at enrollment time.
 * Called once per plan creation. The contribution is 1% of the total
 * transaction amount (bill + fee).
 *
 * Supports an optional Drizzle transaction so it can be called
 * atomically with plan creation.
 */
export async function contributeToRiskPool(
  planId: string,
  contributionCents: number,
  tx?: DrizzleTx,
): Promise<void> {
  if (contributionCents <= 0) {
    throw new RangeError(
      `contributeToRiskPool: contributionCents must be positive, got ${contributionCents}`,
    );
  }

  const executor = tx ?? db;

  await executor.insert(riskPool).values({
    planId,
    contributionCents,
    type: 'contribution',
  });

  await logAuditEvent(
    {
      entityType: 'risk_pool',
      entityId: planId,
      action: 'contributed',
      newValue: { type: 'contribution', contributionCents },
      actorType: 'system',
    },
    tx,
  );
}

// ── Claims ────────────────────────────────────────────────────────────

/**
 * Record a claim against the risk pool when a plan defaults.
 * The claim amount is the remaining unpaid balance that FuzzyCat
 * guarantees to the clinic.
 *
 * Supports an optional Drizzle transaction for atomicity with the
 * plan default operation.
 */
export async function claimFromRiskPool(
  planId: string,
  claimCents: number,
  tx?: DrizzleTx,
): Promise<void> {
  if (claimCents <= 0) {
    throw new RangeError(`claimFromRiskPool: claimCents must be positive, got ${claimCents}`);
  }

  const executor = tx ?? db;

  await executor.insert(riskPool).values({
    planId,
    contributionCents: claimCents,
    type: 'claim',
  });

  await logAuditEvent(
    {
      entityType: 'risk_pool',
      entityId: planId,
      action: 'claimed',
      newValue: { type: 'claim', claimCents },
      actorType: 'system',
    },
    tx,
  );
}

// ── Recoveries ────────────────────────────────────────────────────────

/**
 * Record a recovery (funds returned to the pool from soft collection
 * on a defaulted plan).
 */
export async function recordRecovery(
  planId: string,
  recoveryCents: number,
  tx?: DrizzleTx,
): Promise<void> {
  if (recoveryCents <= 0) {
    throw new RangeError(`recordRecovery: recoveryCents must be positive, got ${recoveryCents}`);
  }

  const executor = tx ?? db;

  await executor.insert(riskPool).values({
    planId,
    contributionCents: recoveryCents,
    type: 'recovery',
  });

  await logAuditEvent(
    {
      entityType: 'risk_pool',
      entityId: planId,
      action: 'recovered',
      newValue: { type: 'recovery', recoveryCents },
      actorType: 'system',
    },
    tx,
  );
}

// ── Balance & health queries ──────────────────────────────────────────

/**
 * Get the current risk pool balance broken down by type.
 *
 * Contributions and recoveries increase the pool; claims decrease it.
 * Uses a single SQL query with conditional aggregation.
 */
export async function getRiskPoolBalance(): Promise<RiskPoolBalance> {
  const result = await db
    .select({
      totalContributionsCents: sql<number>`coalesce(sum(case when ${riskPool.type} = 'contribution' then ${riskPool.contributionCents} else 0 end), 0)`,
      totalClaimsCents: sql<number>`coalesce(sum(case when ${riskPool.type} = 'claim' then ${riskPool.contributionCents} else 0 end), 0)`,
      totalRecoveriesCents: sql<number>`coalesce(sum(case when ${riskPool.type} = 'recovery' then ${riskPool.contributionCents} else 0 end), 0)`,
    })
    .from(riskPool);

  const row = result[0] ?? {
    totalContributionsCents: 0,
    totalClaimsCents: 0,
    totalRecoveriesCents: 0,
  };

  // Ensure values are numbers (SQL aggregates may return strings in some drivers)
  const contributions = Number(row.totalContributionsCents);
  const claims = Number(row.totalClaimsCents);
  const recoveries = Number(row.totalRecoveriesCents);

  return {
    totalContributionsCents: contributions,
    totalClaimsCents: claims,
    totalRecoveriesCents: recoveries,
    balanceCents: contributions + recoveries - claims,
  };
}

/**
 * Get risk pool health metrics for the admin dashboard.
 *
 * Returns the pool balance, total outstanding guarantee exposure
 * (remaining cents on active plans), coverage ratio, and active
 * plan count.
 */
export async function getRiskPoolHealth(): Promise<RiskPoolHealth> {
  const [balance, outstandingResult] = await Promise.all([
    getRiskPoolBalance(),
    db
      .select({
        outstandingCents: sql<number>`coalesce(sum(${plans.remainingCents}), 0)`,
        activePlanCount: count(),
      })
      .from(plans)
      .where(eq(plans.status, 'active')),
  ]);

  const outstanding = outstandingResult[0] ?? { outstandingCents: 0, activePlanCount: 0 };
  const outstandingCents = Number(outstanding.outstandingCents);
  const activePlanCount = Number(outstanding.activePlanCount);

  return {
    balanceCents: balance.balanceCents,
    outstandingGuaranteesCents: outstandingCents,
    coverageRatio: outstandingCents > 0 ? balance.balanceCents / outstandingCents : 0,
    activePlanCount,
  };
}
