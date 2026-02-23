// ── Platform reserve service ─────────────────────────────────────────
// Manages the FuzzyCat platform reserve fund. The reserve is funded by
// 1% of each enrollment and provides financial stability for the platform.
//
// NOTE: The `contributionCents` column in the risk_pool table is reused
// for the contribution amount. This is a known naming issue — the column
// would be better named `amountCents`. A schema migration to rename it
// is deferred to a future PR to avoid unnecessary risk here.

import { count, eq, sql } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import { PLATFORM_RESERVE_RATE } from '@/lib/constants';
import { percentOfCents } from '@/lib/utils/money';
import { db } from '@/server/db';
import { plans, riskPool } from '@/server/db/schema';
import { logAuditEvent } from '@/server/services/audit';

// biome-ignore lint/suspicious/noExplicitAny: Drizzle transaction types are complex generics that vary by driver; using `any` here avoids coupling to a specific driver implementation.
type DrizzleTx = PgTransaction<any, any, any>;

// ── Types ─────────────────────────────────────────────────────────────

export interface ReserveBalance {
  /** Total cents contributed to the reserve across all plans. */
  totalContributionsCents: number;
  /** Net balance (contributions only — no claims or recoveries). */
  balanceCents: number;
}

export interface ReserveHealth {
  /** Current reserve balance in cents. */
  balanceCents: number;
  /** Total remaining cents on active plans (exposure metric). */
  outstandingGuaranteesCents: number;
  /** Ratio of reserve balance to outstanding exposure. */
  coverageRatio: number;
  /** Number of active plans. */
  activePlanCount: number;
}

// ── Contributions ─────────────────────────────────────────────────────

/**
 * Calculate the platform reserve contribution for a given bill amount.
 * Uses PLATFORM_RESERVE_RATE (1%) from constants.
 */
export function calculateContribution(totalWithFeeCents: number): number {
  return percentOfCents(totalWithFeeCents, PLATFORM_RESERVE_RATE);
}

/**
 * Record a contribution to the platform reserve at enrollment time.
 * Called once per plan creation. The contribution is 1% of the total
 * transaction amount (bill + fee).
 *
 * Supports an optional Drizzle transaction so it can be called
 * atomically with plan creation.
 */
export async function contributeToReserve(
  planId: string,
  contributionCents: number,
  tx?: DrizzleTx,
): Promise<void> {
  if (contributionCents <= 0) {
    throw new RangeError(
      `contributeToReserve: contributionCents must be positive, got ${contributionCents}`,
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

/** @deprecated Use contributeToReserve instead. */
export const contributeToRiskPool = contributeToReserve;

// ── Balance & health queries ──────────────────────────────────────────

/**
 * Get the current platform reserve balance.
 *
 * Returns total contributions. Claims and recoveries are no longer used
 * but the query still aggregates them for backwards-compatible admin views.
 */
export async function getRiskPoolBalance(): Promise<
  ReserveBalance & { totalClaimsCents: number; totalRecoveriesCents: number }
> {
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
 * Get platform reserve health metrics for the admin dashboard.
 *
 * Returns the reserve balance, total outstanding exposure
 * (remaining cents on active plans), coverage ratio, and active
 * plan count.
 */
export async function getRiskPoolHealth(): Promise<ReserveHealth> {
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
