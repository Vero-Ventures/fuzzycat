#!/usr/bin/env bun

/**
 * Populate E2E test accounts with realistic data (plans, payments, payouts).
 *
 * Prerequisites: Run `bun run e2e:setup-users` first to create the E2E test
 * users in Supabase and their corresponding DB rows.
 *
 * Run: `bun run e2e:populate-data`
 *
 * This script is additive — it does NOT delete existing data. It skips
 * creation if plans already exist for the E2E clinic+owner pair.
 */

import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import {
  CLINIC_SHARE_RATE,
  NUM_INSTALLMENTS,
  PLATFORM_FEE_RATE,
  RISK_POOL_RATE,
} from '@/lib/constants';
import { db } from '@/server/db';
import type * as schema from '@/server/db/schema';
import { auditLog, clinics, owners, payments, payouts, plans, riskPool } from '@/server/db/schema';

type Tx = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

// ── E2E user emails ──────────────────────────────────────────────────
const CLINIC_EMAIL = process.env.E2E_CLINIC_EMAIL ?? 'e2e-clinic@fuzzycatapp.com';
const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? 'e2e-owner@fuzzycatapp.com';

// ── Payment calculation (mirrors FuzzyCat formula) ───────────────────
function calculatePlan(billCents: number) {
  const feeCents = Math.round(billCents * PLATFORM_FEE_RATE);
  const totalWithFeeCents = billCents + feeCents;
  const depositCents = Math.round(totalWithFeeCents * 0.25);
  const remainingCents = totalWithFeeCents - depositCents;
  const installmentCents = Math.round(remainingCents / NUM_INSTALLMENTS);
  return { feeCents, totalWithFeeCents, depositCents, remainingCents, installmentCents };
}

// ── Time helpers ─────────────────────────────────────────────────────
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const now = new Date();

function weeksAgo(weeks: number): Date {
  return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
}

// ── Plan creation helpers ────────────────────────────────────────────

async function createPlanWithPayments(
  tx: Tx,
  opts: {
    ownerId: string;
    clinicId: string;
    billCents: number;
    status: 'pending' | 'active' | 'completed';
    startDate: Date;
    succeededInstallments: number;
  },
) {
  const calc = calculatePlan(opts.billCents);
  const isActive = opts.status === 'active' || opts.status === 'completed';

  const [planRecord] = await tx
    .insert(plans)
    .values({
      ownerId: opts.ownerId,
      clinicId: opts.clinicId,
      totalBillCents: opts.billCents,
      ...calc,
      numInstallments: NUM_INSTALLMENTS,
      status: opts.status,
      depositPaidAt: isActive ? opts.startDate : null,
      completedAt:
        opts.status === 'completed'
          ? new Date(opts.startDate.getTime() + 12 * 7 * 24 * 60 * 60 * 1000)
          : null,
      nextPaymentAt:
        opts.status === 'active'
          ? new Date(opts.startDate.getTime() + (opts.succeededInstallments + 1) * TWO_WEEKS_MS)
          : null,
    })
    .returning({ id: plans.id });

  console.log(`  Plan ID: ${planRecord.id}`);

  // Create payments
  const paymentIds = await createPayments(tx, {
    planId: planRecord.id,
    calc,
    startDate: opts.startDate,
    succeededInstallments: isActive ? opts.succeededInstallments : 0,
    depositSucceeded: isActive,
  });

  // Create payouts for succeeded payments
  if (isActive) {
    await createPayouts(tx, {
      clinicId: opts.clinicId,
      planId: planRecord.id,
      billCents: opts.billCents,
      calc,
      paymentIds,
      succeededInstallments: opts.succeededInstallments,
    });
  }

  // Risk pool + audit
  await tx.insert(riskPool).values({
    planId: planRecord.id,
    contributionCents: Math.round(calc.totalWithFeeCents * RISK_POOL_RATE),
    type: 'contribution',
  });

  await tx.insert(auditLog).values({
    entityType: 'plan',
    entityId: planRecord.id,
    action: 'created',
    oldValue: null,
    newValue: { status: 'pending', totalBillCents: opts.billCents },
    actorType: 'clinic',
    actorId: null,
  });

  return planRecord.id;
}

async function createPayments(
  tx: Tx,
  opts: {
    planId: string;
    calc: ReturnType<typeof calculatePlan>;
    startDate: Date;
    succeededInstallments: number;
    depositSucceeded: boolean;
  },
) {
  const ids: string[] = [];

  // Deposit
  const [deposit] = await tx
    .insert(payments)
    .values({
      planId: opts.planId,
      type: 'deposit',
      sequenceNum: 0,
      amountCents: opts.calc.depositCents,
      status: opts.depositSucceeded ? 'succeeded' : 'pending',
      stripePaymentIntentId: opts.depositSucceeded ? `pi_e2e_dep_${opts.planId.slice(0, 8)}` : null,
      scheduledAt: opts.startDate,
      processedAt: opts.depositSucceeded ? opts.startDate : null,
    })
    .returning({ id: payments.id });
  ids.push(deposit.id);

  // Installments
  for (let i = 1; i <= NUM_INSTALLMENTS; i++) {
    const scheduledAt = new Date(opts.startDate.getTime() + i * TWO_WEEKS_MS);
    const succeeded = i <= opts.succeededInstallments;
    const [payment] = await tx
      .insert(payments)
      .values({
        planId: opts.planId,
        type: 'installment',
        sequenceNum: i,
        amountCents: opts.calc.installmentCents,
        status: succeeded ? 'succeeded' : 'pending',
        stripePaymentIntentId: succeeded ? `pi_e2e_inst_${opts.planId.slice(0, 8)}_${i}` : null,
        scheduledAt,
        processedAt: succeeded ? scheduledAt : null,
      })
      .returning({ id: payments.id });
    ids.push(payment.id);
  }

  const succeededCount = (opts.depositSucceeded ? 1 : 0) + opts.succeededInstallments;
  const pendingCount = NUM_INSTALLMENTS + 1 - succeededCount;
  console.log(
    `  Created ${NUM_INSTALLMENTS + 1} payments (${succeededCount} succeeded, ${pendingCount} pending)`,
  );

  return ids;
}

async function createPayouts(
  tx: Tx,
  opts: {
    clinicId: string;
    planId: string;
    billCents: number;
    calc: ReturnType<typeof calculatePlan>;
    paymentIds: string[];
    succeededInstallments: number;
  },
) {
  // Deposit payout + installment payouts
  const succeededPaymentIds = opts.paymentIds.slice(0, 1 + opts.succeededInstallments);
  let payoutCount = 0;

  for (let i = 0; i < succeededPaymentIds.length; i++) {
    const amount = i === 0 ? opts.calc.depositCents : opts.calc.installmentCents;
    await tx.insert(payouts).values({
      clinicId: opts.clinicId,
      planId: opts.planId,
      paymentId: succeededPaymentIds[i],
      amountCents: amount,
      clinicShareCents: Math.round(
        opts.billCents * CLINIC_SHARE_RATE * (amount / opts.calc.totalWithFeeCents),
      ),
      stripeTransferId: `tr_e2e_${opts.planId.slice(0, 8)}_${i + 1}`,
      status: 'succeeded',
    });
    payoutCount++;
  }

  console.log(`  Created ${payoutCount} payouts`);
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log('Looking up E2E test users...\n');

  const [clinic] = await db
    .select({ id: clinics.id, name: clinics.name, status: clinics.status })
    .from(clinics)
    .where(eq(clinics.email, CLINIC_EMAIL))
    .limit(1);

  if (!clinic) {
    console.error(`Clinic not found: ${CLINIC_EMAIL}`);
    console.error('Run `bun run e2e:setup-users` first.');
    process.exit(1);
  }

  console.log(`Clinic: ${clinic.name} (${clinic.id}) — status: ${clinic.status}`);

  if (clinic.status !== 'active') {
    console.log('  Activating clinic...');
    await db
      .update(clinics)
      .set({
        status: 'active',
        stripeAccountId: 'acct_test_e2e_clinic',
        name: 'E2E Test Clinic',
        phone: '+15550000000',
        addressLine1: '123 Test Street',
        addressCity: 'San Francisco',
        addressState: 'CA',
        addressZip: '94102',
      })
      .where(eq(clinics.id, clinic.id));
    console.log('  Clinic activated with test Stripe account.');
  }

  const [owner] = await db
    .select({ id: owners.id, name: owners.name })
    .from(owners)
    .where(eq(owners.email, OWNER_EMAIL))
    .limit(1);

  if (!owner) {
    console.error(`Owner not found: ${OWNER_EMAIL}`);
    console.error('Run `bun run e2e:setup-users` first.');
    process.exit(1);
  }

  console.log(`Owner: ${owner.name} (${owner.id})`);

  const existingPlans = await db
    .select({ id: plans.id })
    .from(plans)
    .where(eq(plans.ownerId, owner.id))
    .limit(1);

  if (existingPlans.length > 0) {
    console.log('\nPlans already exist for this owner. Skipping data population.');
    console.log('To repopulate, delete existing plans first.');
    process.exit(0);
  }

  console.log('\nPopulating test data...\n');

  await db.transaction(async (tx) => {
    console.log('Creating Plan 1: $1,200 active plan...');
    await createPlanWithPayments(tx, {
      ownerId: owner.id,
      clinicId: clinic.id,
      billCents: 120_000,
      status: 'active',
      startDate: weeksAgo(8),
      succeededInstallments: 2,
    });

    console.log('\nCreating Plan 2: $2,500 completed plan...');
    await createPlanWithPayments(tx, {
      ownerId: owner.id,
      clinicId: clinic.id,
      billCents: 250_000,
      status: 'completed',
      startDate: weeksAgo(14),
      succeededInstallments: NUM_INSTALLMENTS,
    });

    console.log('\nCreating Plan 3: $750 pending plan...');
    await createPlanWithPayments(tx, {
      ownerId: owner.id,
      clinicId: clinic.id,
      billCents: 75_000,
      status: 'pending',
      startDate: now,
      succeededInstallments: 0,
    });
  });

  console.log('\nE2E data population complete.');
  console.log('Summary:');
  console.log('  - Plan 1: $1,200 active (deposit + 2 installments paid)');
  console.log('  - Plan 2: $2,500 completed (all payments succeeded)');
  console.log('  - Plan 3: $750 pending (awaiting deposit)');
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('E2E data population failed:', error);
    process.exit(1);
  });
