#!/usr/bin/env bun
/**
 * Nuclear reset + comprehensive seed for E2E testing.
 *
 * 1. Deletes ALL Supabase Auth users
 * 2. Truncates ALL app tables (reverse FK order)
 * 3. Creates 3 auth users (owner, clinic, admin)
 * 4. Seeds comprehensive data covering every enum value and business scenario
 *
 * Run: `bun run e2e:reset`
 */

import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import {
  CLINIC_SHARE_RATE,
  NUM_INSTALLMENTS,
  PLATFORM_FEE_RATE,
  PLATFORM_RESERVE_RATE,
} from '@/lib/constants';
import { db } from '@/server/db';
import type * as schema from '@/server/db/schema';
import {
  auditLog,
  clinics,
  owners,
  payments,
  payouts,
  plans,
  riskPool,
  softCollections,
} from '@/server/db/schema';

type Tx = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

// ── Config ──────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const authHeaders = {
  Authorization: `Bearer ${SERVICE_KEY}`,
  apikey: SERVICE_KEY,
  'Content-Type': 'application/json',
};

// ── Payment calculation (mirrors FuzzyCat formula) ──────────────────
function calculatePlan(billCents: number) {
  const feeCents = Math.round(billCents * PLATFORM_FEE_RATE);
  const totalWithFeeCents = billCents + feeCents;
  const depositCents = Math.round(totalWithFeeCents * 0.25);
  const remainingCents = totalWithFeeCents - depositCents;
  const installmentCents = Math.round(remainingCents / NUM_INSTALLMENTS);
  return { feeCents, totalWithFeeCents, depositCents, remainingCents, installmentCents };
}

type PlanCalc = ReturnType<typeof calculatePlan>;

// ── Time helpers ────────────────────────────────────────────────────
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const now = new Date();

function weeksAgo(weeks: number): Date {
  return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
}

function daysAgo(days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function weeksFromNow(weeks: number): Date {
  return new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
}

// ── Auth helpers ────────────────────────────────────────────────────
type AuthUser = { id: string; email?: string };

async function deleteAllAuthUsers() {
  console.log('Deleting all auth users...');
  let deleted = 0;

  while (true) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=100`, {
      headers: authHeaders,
    });

    if (!res.ok) {
      console.error(`  Failed to list users: ${res.status} ${await res.text()}`);
      break;
    }

    const data = (await res.json()) as { users: AuthUser[] };
    if (data.users.length === 0) break;

    for (const user of data.users) {
      const delRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      if (delRes.ok) {
        deleted++;
      } else {
        console.error(`  Failed to delete ${user.email}: ${delRes.status}`);
      }
    }
  }

  console.log(`  Deleted ${deleted} auth users.`);
}

async function createAuthUser(email: string, role: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      email,
      password: PASSWORD,
      email_confirm: true,
      app_metadata: { role },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create auth user ${email}: ${res.status} ${text}`);
  }

  const user = (await res.json()) as AuthUser;
  console.log(`  Auth: ${email} (${role}) → ${user.id}`);
  return user.id;
}

// ── DB insert helpers ───────────────────────────────────────────────

async function insertPayment(
  tx: Tx,
  opts: {
    planId: string;
    type: 'deposit' | 'installment';
    sequenceNum: number;
    amountCents: number;
    status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'retried' | 'written_off';
    scheduledAt: Date;
    processedAt: Date | null;
    stripePaymentIntentId: string | null;
    failureReason?: string | null;
    retryCount?: number;
  },
) {
  const [row] = await tx
    .insert(payments)
    .values({
      planId: opts.planId,
      type: opts.type,
      sequenceNum: opts.sequenceNum,
      amountCents: opts.amountCents,
      status: opts.status,
      scheduledAt: opts.scheduledAt,
      processedAt: opts.processedAt,
      stripePaymentIntentId: opts.stripePaymentIntentId,
      failureReason: opts.failureReason ?? null,
      retryCount: opts.retryCount ?? 0,
    })
    .returning({ id: payments.id });
  return row.id;
}

async function insertPayoutsForPlan(
  tx: Tx,
  opts: {
    clinicId: string;
    planId: string;
    billCents: number;
    calc: PlanCalc;
    paymentIds: string[];
    succeededIndices: number[];
    status?: 'succeeded' | 'pending' | 'failed';
  },
) {
  let count = 0;
  for (const idx of opts.succeededIndices) {
    const amount = idx === 0 ? opts.calc.depositCents : opts.calc.installmentCents;
    const payoutStatus = opts.status ?? 'succeeded';
    await tx.insert(payouts).values({
      clinicId: opts.clinicId,
      planId: opts.planId,
      paymentId: opts.paymentIds[idx],
      amountCents: amount,
      clinicShareCents: Math.round(
        opts.billCents * CLINIC_SHARE_RATE * (amount / opts.calc.totalWithFeeCents),
      ),
      stripeTransferId:
        payoutStatus !== 'pending' ? `tr_e2e_${opts.planId.slice(0, 8)}_${idx}` : null,
      status: payoutStatus,
    });
    count++;
  }
  return count;
}

// ── Seed: simple succeeded/pending installments ─────────────────────

async function seedSimpleInstallments(
  tx: Tx,
  planId: string,
  calc: PlanCalc,
  startDate: Date,
  succeededCount: number,
  prefix: string,
) {
  const ids: string[] = [];
  for (let i = 1; i <= NUM_INSTALLMENTS; i++) {
    const scheduledAt = new Date(startDate.getTime() + i * TWO_WEEKS_MS);
    const succeeded = i <= succeededCount;
    const id = await insertPayment(tx, {
      planId,
      type: 'installment',
      sequenceNum: i,
      amountCents: calc.installmentCents,
      status: succeeded ? 'succeeded' : 'pending',
      scheduledAt,
      processedAt: succeeded ? scheduledAt : null,
      stripePaymentIntentId: succeeded ? `pi_e2e_${prefix}_inst_${i}` : null,
    });
    ids.push(id);
  }
  return ids;
}

// ── Seed: Plan 5 installments (defaulted scenario) ──────────────────

async function seedPlan5Installments(tx: Tx, planId: string, calc: PlanCalc, startDate: Date) {
  const ids: string[] = [];
  for (let i = 1; i <= NUM_INSTALLMENTS; i++) {
    const scheduledAt = new Date(startDate.getTime() + i * TWO_WEEKS_MS);
    const p5Status = getPlan5InstallmentStatus(i);
    const id = await insertPayment(tx, {
      planId,
      type: 'installment',
      sequenceNum: i,
      amountCents: calc.installmentCents,
      status: p5Status.status,
      scheduledAt,
      processedAt: p5Status.processed ? scheduledAt : null,
      stripePaymentIntentId: p5Status.piId ? `pi_e2e_p5_inst_${p5Status.piId}` : null,
      failureReason: p5Status.failureReason,
      retryCount: p5Status.retryCount,
    });
    ids.push(id);
  }
  return ids;
}

function getPlan5InstallmentStatus(i: number) {
  if (i <= 2) {
    return {
      status: 'succeeded' as const,
      processed: true,
      piId: `${i}`,
      failureReason: null,
      retryCount: 0,
    };
  }
  if (i === 3) {
    return {
      status: 'failed' as const,
      processed: true,
      piId: '3_fail',
      failureReason: 'insufficient_funds',
      retryCount: 3,
    };
  }
  return {
    status: 'written_off' as const,
    processed: false,
    piId: null,
    failureReason: null,
    retryCount: 0,
  };
}

// ── Seed: Plan 7 installments (edge case scenario) ──────────────────

async function seedPlan7Installments(tx: Tx, planId: string, calc: PlanCalc, startDate: Date) {
  const ids: string[] = [];
  for (let i = 1; i <= NUM_INSTALLMENTS; i++) {
    const scheduledAt = new Date(startDate.getTime() + i * TWO_WEEKS_MS);
    const p7 = getPlan7InstallmentStatus(i, scheduledAt);
    const id = await insertPayment(tx, {
      planId,
      type: 'installment',
      sequenceNum: i,
      amountCents: calc.installmentCents,
      status: p7.status,
      scheduledAt,
      processedAt: p7.processedAt,
      stripePaymentIntentId: p7.piId,
      retryCount: p7.retryCount,
    });
    ids.push(id);
  }
  return ids;
}

function getPlan7InstallmentStatus(i: number, scheduledAt: Date) {
  if (i <= 3) {
    return {
      status: 'succeeded' as const,
      processedAt: scheduledAt,
      piId: `pi_e2e_p7_inst_${i}`,
      retryCount: 0,
    };
  }
  if (i === 4) {
    const retryDate = new Date(scheduledAt.getTime() + 3 * 24 * 60 * 60 * 1000);
    return {
      status: 'retried' as const,
      processedAt: retryDate,
      piId: 'pi_e2e_p7_inst_4_retry',
      retryCount: 1,
    };
  }
  if (i === 5) {
    return {
      status: 'processing' as const,
      processedAt: null,
      piId: 'pi_e2e_p7_inst_5_proc',
      retryCount: 0,
    };
  }
  return { status: 'pending' as const, processedAt: null, piId: null, retryCount: 0 };
}

// ── Seed: Clinics ───────────────────────────────────────────────────

async function seedClinics(tx: Tx, clinicAuthId: string) {
  console.log('Creating clinics...');

  const [clinic1] = await tx
    .insert(clinics)
    .values({
      authId: clinicAuthId,
      name: 'Sunset Veterinary Hospital',
      email: 'e2e-clinic@fuzzycatapp.com',
      phone: '(415) 555-0100',
      addressLine1: '1234 Sunset Blvd',
      addressCity: 'San Francisco',
      addressState: 'CA',
      addressZip: '94122',
      stripeAccountId: 'acct_test_sunset',
      status: 'active',
    })
    .returning({ id: clinics.id });

  const [clinic2] = await tx
    .insert(clinics)
    .values({
      name: 'Pacific Paws Animal Clinic',
      email: 'pacific-paws@example.com',
      phone: '(415) 555-0200',
      addressLine1: '567 Pacific Ave',
      addressCity: 'San Francisco',
      addressState: 'CA',
      addressZip: '94115',
      stripeAccountId: null,
      status: 'pending',
    })
    .returning({ id: clinics.id });

  const [clinic3] = await tx
    .insert(clinics)
    .values({
      name: 'Bay Area Animal Care',
      email: 'bayarea-care@example.com',
      phone: '(510) 555-0300',
      addressLine1: '890 Bay St',
      addressCity: 'Oakland',
      addressState: 'CA',
      addressZip: '94607',
      stripeAccountId: 'acct_test_bayarea',
      status: 'suspended',
    })
    .returning({ id: clinics.id });

  console.log(`  Clinic 1 (active):    ${clinic1.id}`);
  console.log(`  Clinic 2 (pending):   ${clinic2.id}`);
  console.log(`  Clinic 3 (suspended): ${clinic3.id}`);

  return { clinic1, clinic2, clinic3 };
}

// ── Seed: Owners ────────────────────────────────────────────────────

async function seedOwners(tx: Tx, ownerAuthId: string) {
  console.log('Creating owners...');

  const [owner1] = await tx
    .insert(owners)
    .values({
      authId: ownerAuthId,
      name: 'Alice Johnson',
      email: 'e2e-owner@fuzzycatapp.com',
      phone: '(415) 555-1001',
      addressLine1: '100 Main St, Apt 4B',
      addressCity: 'San Francisco',
      addressState: 'CA',
      addressZip: '94105',
      petName: 'Whiskers',
      paymentMethod: 'debit_card',
      stripeCustomerId: 'cus_test_alice',
      stripeCardPaymentMethodId: 'pm_test_alice_card',
    })
    .returning({ id: owners.id });

  const [owner2] = await tx
    .insert(owners)
    .values({
      name: 'Bob Martinez',
      email: 'bob-martinez@example.com',
      phone: '(415) 555-1002',
      addressLine1: '200 Market St',
      addressCity: 'San Francisco',
      addressState: 'CA',
      addressZip: '94103',
      petName: 'Mittens',
      paymentMethod: 'bank_account',
      stripeCustomerId: 'cus_test_bob',
      stripeAchPaymentMethodId: 'pm_test_bob_ach',
      plaidAccessToken: 'access-sandbox-test-bob',
      plaidItemId: 'item-sandbox-test-bob',
      plaidAccountId: 'acct-sandbox-test-bob',
    })
    .returning({ id: owners.id });

  const [owner3] = await tx
    .insert(owners)
    .values({
      name: 'Carol Chen',
      email: 'carol-chen@example.com',
      phone: '(310) 555-1003',
      addressLine1: '300 Wilshire Blvd',
      addressCity: 'Los Angeles',
      addressState: 'CA',
      addressZip: '90010',
      petName: 'Luna',
      paymentMethod: 'debit_card',
      stripeCustomerId: 'cus_test_carol',
      stripeCardPaymentMethodId: 'pm_test_carol_card',
    })
    .returning({ id: owners.id });

  console.log(`  Owner 1 (Alice, debit_card):    ${owner1.id}`);
  console.log(`  Owner 2 (Bob, bank_account):     ${owner2.id}`);
  console.log(`  Owner 3 (Carol, debit_card):     ${owner3.id}`);

  return { owner1, owner2, owner3 };
}

// ── Seed: Plans + Payments ──────────────────────────────────────────

interface PlanSeedResult {
  planId: string;
  calc: PlanCalc;
  paymentIds: string[];
  startDate: Date;
}

async function seedPlansAndPayments(
  tx: Tx,
  ids: {
    owner1Id: string;
    owner2Id: string;
    owner3Id: string;
    clinic1Id: string;
    clinic2Id: string;
  },
): Promise<{ plans: PlanSeedResult[] }> {
  console.log('Creating plans and payments...');
  const results: PlanSeedResult[] = [];

  // Plan 1: Alice → Sunset, $1,200, active (deposit + 2 inst succeeded, 4 pending)
  const r1 = await seedPlan1(tx, ids.owner1Id, ids.clinic1Id);
  results.push(r1);

  // Plan 2: Alice → Sunset, $2,500, completed (all succeeded)
  const r2 = await seedPlan2(tx, ids.owner1Id, ids.clinic1Id);
  results.push(r2);

  // Plan 3: Bob → Sunset, $750, pending (all pending)
  const r3 = await seedPlan3(tx, ids.owner2Id, ids.clinic1Id);
  results.push(r3);

  // Plan 4: Bob → Sunset, $3,000, deposit_paid (deposit succeeded, inst pending)
  const r4 = await seedPlan4(tx, ids.owner2Id, ids.clinic1Id);
  results.push(r4);

  // Plan 5: Carol → Pacific Paws, $1,500, defaulted
  const r5 = await seedPlan5(tx, ids.owner3Id, ids.clinic2Id);
  results.push(r5);

  // Plan 6: Carol → Sunset, $900, cancelled
  const r6 = await seedPlan6(tx, ids.owner3Id, ids.clinic1Id);
  results.push(r6);

  // Plan 7: Alice → Sunset, $5,000, active (edge cases)
  const r7 = await seedPlan7(tx, ids.owner1Id, ids.clinic1Id);
  results.push(r7);

  return { plans: results };
}

async function seedPlan1(tx: Tx, ownerId: string, clinicId: string): Promise<PlanSeedResult> {
  const calc = calculatePlan(120_000);
  const startDate = weeksAgo(8);
  const [plan] = await tx
    .insert(plans)
    .values({
      ownerId,
      clinicId,
      totalBillCents: 120_000,
      ...calc,
      numInstallments: NUM_INSTALLMENTS,
      status: 'active',
      depositPaidAt: startDate,
      nextPaymentAt: new Date(startDate.getTime() + 3 * TWO_WEEKS_MS),
    })
    .returning({ id: plans.id });
  console.log(`  Plan 1 (active, $1,200):      ${plan.id}`);

  const depositId = await insertPayment(tx, {
    planId: plan.id,
    type: 'deposit',
    sequenceNum: 0,
    amountCents: calc.depositCents,
    status: 'succeeded',
    scheduledAt: startDate,
    processedAt: startDate,
    stripePaymentIntentId: 'pi_e2e_p1_dep',
  });
  const instIds = await seedSimpleInstallments(tx, plan.id, calc, startDate, 2, 'p1');

  return { planId: plan.id, calc, paymentIds: [depositId, ...instIds], startDate };
}

async function seedPlan2(tx: Tx, ownerId: string, clinicId: string): Promise<PlanSeedResult> {
  const calc = calculatePlan(250_000);
  const startDate = weeksAgo(14);
  const [plan] = await tx
    .insert(plans)
    .values({
      ownerId,
      clinicId,
      totalBillCents: 250_000,
      ...calc,
      numInstallments: NUM_INSTALLMENTS,
      status: 'completed',
      depositPaidAt: startDate,
      completedAt: new Date(startDate.getTime() + NUM_INSTALLMENTS * TWO_WEEKS_MS),
    })
    .returning({ id: plans.id });
  console.log(`  Plan 2 (completed, $2,500):   ${plan.id}`);

  const depositId = await insertPayment(tx, {
    planId: plan.id,
    type: 'deposit',
    sequenceNum: 0,
    amountCents: calc.depositCents,
    status: 'succeeded',
    scheduledAt: startDate,
    processedAt: startDate,
    stripePaymentIntentId: 'pi_e2e_p2_dep',
  });
  const instIds = await seedSimpleInstallments(
    tx,
    plan.id,
    calc,
    startDate,
    NUM_INSTALLMENTS,
    'p2',
  );

  return { planId: plan.id, calc, paymentIds: [depositId, ...instIds], startDate };
}

async function seedPlan3(tx: Tx, ownerId: string, clinicId: string): Promise<PlanSeedResult> {
  const calc = calculatePlan(75_000);
  const startDate = now;
  const [plan] = await tx
    .insert(plans)
    .values({
      ownerId,
      clinicId,
      totalBillCents: 75_000,
      ...calc,
      numInstallments: NUM_INSTALLMENTS,
      status: 'pending',
    })
    .returning({ id: plans.id });
  console.log(`  Plan 3 (pending, $750):       ${plan.id}`);

  const paymentIds: string[] = [];
  for (let i = 0; i <= NUM_INSTALLMENTS; i++) {
    const scheduledAt = new Date(startDate.getTime() + i * TWO_WEEKS_MS);
    const id = await insertPayment(tx, {
      planId: plan.id,
      type: i === 0 ? 'deposit' : 'installment',
      sequenceNum: i,
      amountCents: i === 0 ? calc.depositCents : calc.installmentCents,
      status: 'pending',
      scheduledAt,
      processedAt: null,
      stripePaymentIntentId: null,
    });
    paymentIds.push(id);
  }

  return { planId: plan.id, calc, paymentIds, startDate };
}

async function seedPlan4(tx: Tx, ownerId: string, clinicId: string): Promise<PlanSeedResult> {
  const calc = calculatePlan(300_000);
  const startDate = weeksAgo(1);
  const [plan] = await tx
    .insert(plans)
    .values({
      ownerId,
      clinicId,
      totalBillCents: 300_000,
      ...calc,
      numInstallments: NUM_INSTALLMENTS,
      status: 'deposit_paid',
      depositPaidAt: startDate,
      nextPaymentAt: new Date(startDate.getTime() + TWO_WEEKS_MS),
    })
    .returning({ id: plans.id });
  console.log(`  Plan 4 (deposit_paid, $3,000): ${plan.id}`);

  const depositId = await insertPayment(tx, {
    planId: plan.id,
    type: 'deposit',
    sequenceNum: 0,
    amountCents: calc.depositCents,
    status: 'succeeded',
    scheduledAt: startDate,
    processedAt: startDate,
    stripePaymentIntentId: 'pi_e2e_p4_dep',
  });
  const instIds = await seedSimpleInstallments(tx, plan.id, calc, startDate, 0, 'p4');

  return { planId: plan.id, calc, paymentIds: [depositId, ...instIds], startDate };
}

async function seedPlan5(tx: Tx, ownerId: string, clinicId: string): Promise<PlanSeedResult> {
  const calc = calculatePlan(150_000);
  const startDate = weeksAgo(12);
  const [plan] = await tx
    .insert(plans)
    .values({
      ownerId,
      clinicId,
      totalBillCents: 150_000,
      ...calc,
      numInstallments: NUM_INSTALLMENTS,
      status: 'defaulted',
      depositPaidAt: startDate,
    })
    .returning({ id: plans.id });
  console.log(`  Plan 5 (defaulted, $1,500):   ${plan.id}`);

  const depositId = await insertPayment(tx, {
    planId: plan.id,
    type: 'deposit',
    sequenceNum: 0,
    amountCents: calc.depositCents,
    status: 'succeeded',
    scheduledAt: startDate,
    processedAt: startDate,
    stripePaymentIntentId: 'pi_e2e_p5_dep',
  });
  const instIds = await seedPlan5Installments(tx, plan.id, calc, startDate);

  return { planId: plan.id, calc, paymentIds: [depositId, ...instIds], startDate };
}

async function seedPlan6(tx: Tx, ownerId: string, clinicId: string): Promise<PlanSeedResult> {
  const calc = calculatePlan(90_000);
  const startDate = weeksAgo(6);
  const [plan] = await tx
    .insert(plans)
    .values({
      ownerId,
      clinicId,
      totalBillCents: 90_000,
      ...calc,
      numInstallments: NUM_INSTALLMENTS,
      status: 'cancelled',
      depositPaidAt: startDate,
    })
    .returning({ id: plans.id });
  console.log(`  Plan 6 (cancelled, $900):     ${plan.id}`);

  const depositId = await insertPayment(tx, {
    planId: plan.id,
    type: 'deposit',
    sequenceNum: 0,
    amountCents: calc.depositCents,
    status: 'succeeded',
    scheduledAt: startDate,
    processedAt: startDate,
    stripePaymentIntentId: 'pi_e2e_p6_dep',
  });
  const instIds = await seedSimpleInstallments(tx, plan.id, calc, startDate, 1, 'p6');

  return { planId: plan.id, calc, paymentIds: [depositId, ...instIds], startDate };
}

async function seedPlan7(tx: Tx, ownerId: string, clinicId: string): Promise<PlanSeedResult> {
  const calc = calculatePlan(500_000);
  const startDate = weeksAgo(10);
  const [plan] = await tx
    .insert(plans)
    .values({
      ownerId,
      clinicId,
      totalBillCents: 500_000,
      ...calc,
      numInstallments: NUM_INSTALLMENTS,
      status: 'active',
      depositPaidAt: startDate,
      nextPaymentAt: new Date(startDate.getTime() + 6 * TWO_WEEKS_MS),
    })
    .returning({ id: plans.id });
  console.log(`  Plan 7 (active, $5,000):      ${plan.id}`);

  const depositId = await insertPayment(tx, {
    planId: plan.id,
    type: 'deposit',
    sequenceNum: 0,
    amountCents: calc.depositCents,
    status: 'succeeded',
    scheduledAt: startDate,
    processedAt: startDate,
    stripePaymentIntentId: 'pi_e2e_p7_dep',
  });
  const instIds = await seedPlan7Installments(tx, plan.id, calc, startDate);

  return { planId: plan.id, calc, paymentIds: [depositId, ...instIds], startDate };
}

// ── Seed: Payouts ───────────────────────────────────────────────────

async function seedPayouts(tx: Tx, clinic1Id: string, clinic2Id: string, p: PlanSeedResult[]) {
  console.log('Creating payouts...');
  let count = 0;

  // Plan 1: deposit + inst 1-2 succeeded
  count += await insertPayoutsForPlan(tx, {
    clinicId: clinic1Id,
    planId: p[0].planId,
    billCents: 120_000,
    calc: p[0].calc,
    paymentIds: p[0].paymentIds,
    succeededIndices: [0, 1, 2],
  });

  // Plan 2: all 7 succeeded
  count += await insertPayoutsForPlan(tx, {
    clinicId: clinic1Id,
    planId: p[1].planId,
    billCents: 250_000,
    calc: p[1].calc,
    paymentIds: p[1].paymentIds,
    succeededIndices: [0, 1, 2, 3, 4, 5, 6],
  });

  // Plan 4: deposit succeeded
  count += await insertPayoutsForPlan(tx, {
    clinicId: clinic1Id,
    planId: p[3].planId,
    billCents: 300_000,
    calc: p[3].calc,
    paymentIds: p[3].paymentIds,
    succeededIndices: [0],
  });

  // Plan 5: deposit + inst 1-2 succeeded
  count += await insertPayoutsForPlan(tx, {
    clinicId: clinic2Id,
    planId: p[4].planId,
    billCents: 150_000,
    calc: p[4].calc,
    paymentIds: p[4].paymentIds,
    succeededIndices: [0, 1, 2],
  });

  // Plan 5: one failed payout (Stripe Connect issue before suspension)
  await tx.insert(payouts).values({
    clinicId: clinic2Id,
    planId: p[4].planId,
    paymentId: p[4].paymentIds[3],
    amountCents: p[4].calc.installmentCents,
    clinicShareCents: Math.round(
      150_000 * CLINIC_SHARE_RATE * (p[4].calc.installmentCents / p[4].calc.totalWithFeeCents),
    ),
    stripeTransferId: `tr_e2e_${p[4].planId.slice(0, 8)}_fail`,
    status: 'failed',
  });
  count++;

  // Plan 6: deposit + inst 1 succeeded
  count += await insertPayoutsForPlan(tx, {
    clinicId: clinic1Id,
    planId: p[5].planId,
    billCents: 90_000,
    calc: p[5].calc,
    paymentIds: p[5].paymentIds,
    succeededIndices: [0, 1],
  });

  // Plan 7: deposit + inst 1-3 succeeded + inst 4 retried
  count += await insertPayoutsForPlan(tx, {
    clinicId: clinic1Id,
    planId: p[6].planId,
    billCents: 500_000,
    calc: p[6].calc,
    paymentIds: p[6].paymentIds,
    succeededIndices: [0, 1, 2, 3, 4],
  });

  // Plan 7: pending payout
  await tx.insert(payouts).values({
    clinicId: clinic1Id,
    planId: p[6].planId,
    paymentId: p[6].paymentIds[4],
    amountCents: p[6].calc.installmentCents,
    clinicShareCents: Math.round(
      500_000 * CLINIC_SHARE_RATE * (p[6].calc.installmentCents / p[6].calc.totalWithFeeCents),
    ),
    stripeTransferId: null,
    status: 'pending',
  });
  count++;

  console.log(`  Created ${count} payouts.`);
}

// ── Seed: Risk pool ─────────────────────────────────────────────────

async function seedRiskPool(tx: Tx, p: PlanSeedResult[]) {
  console.log('Creating risk pool entries...');

  for (const plan of p) {
    await tx.insert(riskPool).values({
      planId: plan.planId,
      contributionCents: Math.round(plan.calc.totalWithFeeCents * PLATFORM_RESERVE_RATE),
      type: 'contribution',
    });
  }

  // Plan 5 claim (defaulted) — keep smaller than total contributions so balance stays positive
  const claimCents = 10_000;
  await tx.insert(riskPool).values({
    planId: p[4].planId,
    contributionCents: claimCents,
    type: 'claim',
  });

  // Plan 5 recovery (partial — 30% of claim)
  await tx.insert(riskPool).values({
    planId: p[4].planId,
    contributionCents: Math.round(claimCents * 0.3),
    type: 'recovery',
  });

  console.log(
    `  Created ${p.length + 2} risk pool entries (7 contributions + 1 claim + 1 recovery).`,
  );
}

// ── Seed: Soft collections ──────────────────────────────────────────

async function seedSoftCollections(tx: Tx, p: PlanSeedResult[]) {
  console.log('Creating soft collections...');

  await tx.insert(softCollections).values({
    planId: p[6].planId,
    stage: 'day_1_reminder',
    startedAt: daysAgo(1),
    nextEscalationAt: weeksFromNow(1),
    notes: 'Installment 5 payment processing — day 1 reminder sent',
  });

  await tx.insert(softCollections).values({
    planId: p[0].planId,
    stage: 'day_7_followup',
    startedAt: daysAgo(7),
    lastEscalatedAt: daysAgo(1),
    nextEscalationAt: weeksFromNow(1),
    notes: 'Installment 3 was late, now in follow-up',
  });

  await tx.insert(softCollections).values({
    planId: p[4].planId,
    stage: 'day_14_final',
    startedAt: daysAgo(14),
    lastEscalatedAt: daysAgo(7),
    nextEscalationAt: daysAgo(0),
    notes: 'Final notice before default',
  });

  await tx.insert(softCollections).values({
    planId: p[1].planId,
    stage: 'completed',
    startedAt: weeksAgo(10),
    lastEscalatedAt: weeksAgo(9),
    notes: 'Owner was late at one point, collection resolved successfully',
  });

  await tx.insert(softCollections).values({
    planId: p[5].planId,
    stage: 'cancelled',
    startedAt: weeksAgo(3),
    lastEscalatedAt: weeksAgo(2),
    notes: 'Collection cancelled when plan was cancelled',
  });

  console.log('  Created 5 soft collections (all stages covered).');
}

// ── Seed: Audit log ─────────────────────────────────────────────────

async function seedAuditLog(
  tx: Tx,
  p: PlanSeedResult[],
  clinic1Id: string,
  clinic3Id: string,
  owner3Id: string,
) {
  console.log('Creating audit log entries...');

  const entries = [
    {
      entityType: 'plan',
      entityId: p[0].planId,
      action: 'plan.created',
      oldValue: null,
      newValue: { status: 'pending', totalBillCents: 120_000 },
      actorType: 'clinic' as const,
      actorId: clinic1Id,
      createdAt: p[0].startDate,
    },
    {
      entityType: 'plan',
      entityId: p[1].planId,
      action: 'plan.created',
      oldValue: null,
      newValue: { status: 'pending', totalBillCents: 250_000 },
      actorType: 'clinic' as const,
      actorId: clinic1Id,
      createdAt: p[1].startDate,
    },
    {
      entityType: 'plan',
      entityId: p[0].planId,
      action: 'plan.status_changed',
      oldValue: { status: 'pending' },
      newValue: { status: 'active' },
      actorType: 'system' as const,
      actorId: null,
      createdAt: p[0].startDate,
    },
    {
      entityType: 'plan',
      entityId: p[1].planId,
      action: 'plan.status_changed',
      oldValue: { status: 'pending' },
      newValue: { status: 'active' },
      actorType: 'system' as const,
      actorId: null,
      createdAt: p[1].startDate,
    },
    {
      entityType: 'payment',
      entityId: p[0].paymentIds[0],
      action: 'payment.succeeded',
      oldValue: { status: 'pending' },
      newValue: { status: 'succeeded' },
      actorType: 'system' as const,
      actorId: null,
      createdAt: p[0].startDate,
    },
    {
      entityType: 'payment',
      entityId: p[1].paymentIds[0],
      action: 'payment.succeeded',
      oldValue: { status: 'pending' },
      newValue: { status: 'succeeded' },
      actorType: 'system' as const,
      actorId: null,
      createdAt: p[1].startDate,
    },
    {
      entityType: 'payment',
      entityId: p[4].paymentIds[3],
      action: 'payment.failed',
      oldValue: { status: 'pending' },
      newValue: { status: 'failed', failureReason: 'insufficient_funds' },
      actorType: 'system' as const,
      actorId: null,
      createdAt: new Date(p[4].startDate.getTime() + 3 * TWO_WEEKS_MS),
    },
    {
      entityType: 'plan',
      entityId: p[4].planId,
      action: 'plan.defaulted',
      oldValue: { status: 'active' },
      newValue: { status: 'defaulted' },
      actorType: 'system' as const,
      actorId: null,
      createdAt: new Date(p[4].startDate.getTime() + 4 * TWO_WEEKS_MS),
    },
    {
      entityType: 'plan',
      entityId: p[5].planId,
      action: 'plan.cancelled',
      oldValue: { status: 'active' },
      newValue: { status: 'cancelled' },
      actorType: 'owner' as const,
      actorId: owner3Id,
      createdAt: weeksAgo(3),
    },
    {
      entityType: 'clinic',
      entityId: clinic1Id,
      action: 'clinic.approved',
      oldValue: { status: 'pending' },
      newValue: { status: 'active' },
      actorType: 'admin' as const,
      actorId: null,
      createdAt: weeksAgo(16),
    },
    {
      entityType: 'clinic',
      entityId: clinic3Id,
      action: 'clinic.suspended',
      oldValue: { status: 'active' },
      newValue: { status: 'suspended' },
      actorType: 'admin' as const,
      actorId: null,
      createdAt: weeksAgo(2),
    },
    {
      entityType: 'soft_collection',
      entityId: p[4].planId,
      action: 'soft_collection.escalated',
      oldValue: { stage: 'day_7_followup' },
      newValue: { stage: 'day_14_final' },
      actorType: 'system' as const,
      actorId: null,
      createdAt: daysAgo(7),
    },
    {
      entityType: 'payout',
      entityId: p[1].planId,
      action: 'payout.succeeded',
      oldValue: { status: 'pending' },
      newValue: { status: 'succeeded' },
      actorType: 'system' as const,
      actorId: null,
      createdAt: new Date(p[1].startDate.getTime() + TWO_WEEKS_MS),
    },
  ];

  for (const entry of entries) {
    await tx.insert(auditLog).values(entry);
  }

  console.log(`  Created ${entries.length} audit log entries (all actor_type values covered).`);
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nTarget: ${SUPABASE_URL}`);
  console.log('='.repeat(60));

  // Step 1: Nuke everything
  console.log('\n── Step 1: Nuke everything ──\n');
  await deleteAllAuthUsers();

  console.log('Truncating all tables...');
  await db.execute(sql`
    TRUNCATE TABLE
      soft_collections, audit_log, risk_pool, payouts, payments, plans, owners, clinics
    CASCADE
  `);
  console.log('  All tables truncated.');

  // Step 2: Create auth users
  console.log('\n── Step 2: Create auth users ──\n');
  const ownerAuthId = await createAuthUser('e2e-owner@fuzzycatapp.com', 'owner');
  const clinicAuthId = await createAuthUser('e2e-clinic@fuzzycatapp.com', 'clinic');
  const adminAuthId = await createAuthUser('e2e-admin@fuzzycatapp.com', 'admin');
  console.log(`  Admin auth ID: ${adminAuthId} (no DB row needed)`);

  // Steps 3–10: Seed DB
  console.log('\n── Step 3–10: Seed database ──\n');

  await db.transaction(async (tx) => {
    const { clinic1, clinic2, clinic3 } = await seedClinics(tx, clinicAuthId);
    const { owner1, owner2, owner3 } = await seedOwners(tx, ownerAuthId);

    const { plans: p } = await seedPlansAndPayments(tx, {
      owner1Id: owner1.id,
      owner2Id: owner2.id,
      owner3Id: owner3.id,
      clinic1Id: clinic1.id,
      clinic2Id: clinic2.id,
    });

    await seedPayouts(tx, clinic1.id, clinic2.id, p);
    await seedRiskPool(tx, p);
    await seedSoftCollections(tx, p);
    await seedAuditLog(tx, p, clinic1.id, clinic3.id, owner3.id);
  });

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('Seed complete!\n');
  console.log('Auth users: 3 (owner, clinic, admin)');
  console.log('Clinics:    3 (active, pending, suspended)');
  console.log('Owners:     3 (Alice/debit_card, Bob/bank_account, Carol/debit_card)');
  console.log('Plans:      7 (pending, deposit_paid, active x2, completed, defaulted, cancelled)');
  console.log('Payments:   49 (7 plans x 7 payments each)');
  console.log('Payouts:    ~20 (succeeded, pending, failed)');
  console.log('Risk pool:  9 (7 contributions + 1 claim + 1 recovery)');
  console.log('Soft coll:  5 (all stages)');
  console.log('Audit log:  13 (all actor types + key actions)');
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('\nSeed failed:', error);
    process.exit(1);
  });
