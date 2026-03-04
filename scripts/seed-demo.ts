#!/usr/bin/env bun
/**
 * Seed the dev database with realistic demo data at scale.
 *
 * ADDITIVE: Does not delete existing seed data. Cleans only its own demo data
 * (by email pattern `e2e-owner-N@fuzzycatapp.com`) before re-inserting.
 *
 * Creates:
 *   - 50 Supabase auth accounts (e2e-owner-1 through e2e-owner-50)
 *   - 8 new clinics (all linked to e2e-clinic auth ID)
 *   - 50 new pet clients with auth accounts
 *   - ~75 plans with mixed statuses
 *   - ~525 payments, payouts, audit log, risk pool, soft collections
 *
 * Usage: bun run db:seed:demo
 */

import { eq, ilike, inArray, sql } from 'drizzle-orm';
import {
  CLINIC_SHARE_RATE,
  NUM_INSTALLMENTS,
  PLATFORM_FEE_RATE,
  PLATFORM_RESERVE_RATE,
} from '@/lib/constants';
import { db } from '@/server/db';
import {
  auditLog,
  clients,
  clinics,
  payments,
  payouts,
  pets,
  plans,
  riskPool,
  softCollections,
} from '@/server/db/schema';

// ── Config ──────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!';
const CLINIC_EMAIL = process.env.E2E_CLINIC_EMAIL ?? 'e2e-clinic@fuzzycatapp.com';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// ── Constants ───────────────────────────────────────────────────────
const NUM_OWNERS = 50;
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date();

type PlanStatus = 'active' | 'completed' | 'pending' | 'defaulted' | 'cancelled';

// ── Name data ───────────────────────────────────────────────────────
const FIRST_NAMES = [
  'Emma',
  'Liam',
  'Olivia',
  'Noah',
  'Ava',
  'Ethan',
  'Sophia',
  'Mason',
  'Isabella',
  'James',
  'Mia',
  'Benjamin',
  'Charlotte',
  'Lucas',
  'Amelia',
  'Henry',
  'Harper',
  'Alexander',
  'Evelyn',
  'Daniel',
  'Abigail',
  'Michael',
  'Emily',
  'Sebastian',
  'Elizabeth',
  'Jack',
  'Sofia',
  'Owen',
  'Avery',
  'Theodore',
  'Ella',
  'Aiden',
  'Scarlett',
  'Samuel',
  'Grace',
  'Ryan',
  'Chloe',
  'Jackson',
  'Victoria',
  'Wyatt',
  'Riley',
  'Matthew',
  'Aria',
  'Luke',
  'Lily',
  'David',
  'Aurora',
  'Carter',
  'Zoey',
  'Julian',
];

const LAST_NAMES = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzalez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Taylor',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
  'Perez',
  'Thompson',
  'White',
  'Harris',
  'Sanchez',
  'Clark',
  'Ramirez',
  'Lewis',
  'Robinson',
  'Walker',
  'Young',
  'Allen',
  'King',
  'Wright',
  'Scott',
  'Torres',
  'Nguyen',
  'Hill',
  'Flores',
  'Green',
  'Adams',
  'Nelson',
  'Baker',
  'Hall',
  'Rivera',
  'Campbell',
  'Mitchell',
  'Carter',
  'Roberts',
];

const PET_NAMES = [
  'Bella',
  'Max',
  'Luna',
  'Charlie',
  'Daisy',
  'Cooper',
  'Milo',
  'Sadie',
  'Buddy',
  'Molly',
  'Bear',
  'Stella',
  'Tucker',
  'Penny',
  'Duke',
  'Maggie',
  'Rocky',
  'Willow',
  'Zeus',
  'Rosie',
  'Buster',
  'Lola',
  'Murphy',
  'Pepper',
  'Leo',
  'Coco',
  'Finn',
  'Gracie',
  'Oscar',
  'Ruby',
  'Teddy',
  'Olive',
  'Rusty',
  'Hazel',
  'Gus',
  'Nala',
  'Louie',
  'Winnie',
  'Bruno',
  'Piper',
  'Hank',
  'Millie',
  'Rex',
  'Maple',
  'Scout',
  'Ellie',
  'Thor',
  'Mocha',
  'Archie',
  'Bailey',
];

const PET_SPECIES = ['dog', 'cat', 'dog', 'cat', 'dog', 'cat', 'dog', 'cat', 'other', 'dog'];
const DOG_BREEDS = [
  'Labrador Retriever',
  'Golden Retriever',
  'French Bulldog',
  'German Shepherd',
  'Poodle',
  'Beagle',
  'Rottweiler',
  'Dachshund',
  'Corgi',
  'Husky',
  'Boxer',
  'Great Dane',
  'Doberman',
  'Australian Shepherd',
  'Shih Tzu',
];
const CAT_BREEDS = [
  'Persian',
  'Maine Coon',
  'Siamese',
  'Ragdoll',
  'British Shorthair',
  'Abyssinian',
  'Bengal',
  'Sphynx',
  'Scottish Fold',
  'Russian Blue',
];

const CLINIC_DATA = [
  {
    name: 'Willow Creek Animal Hospital',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    phone: '(512) 555-0301',
  },
  {
    name: 'Bayshore Veterinary Clinic',
    city: 'Tampa',
    state: 'FL',
    zip: '33602',
    phone: '(813) 555-0302',
  },
  {
    name: 'Mountain View Pet Care',
    city: 'Denver',
    state: 'CO',
    zip: '80202',
    phone: '(303) 555-0303',
  },
  {
    name: 'Lakeside Animal Hospital',
    city: 'Chicago',
    state: 'IL',
    zip: '60601',
    phone: '(312) 555-0304',
  },
  {
    name: 'Harbor Pet Clinic',
    city: 'Seattle',
    state: 'WA',
    zip: '98101',
    phone: '(206) 555-0305',
  },
  {
    name: 'Pinecrest Veterinary Center',
    city: 'Portland',
    state: 'OR',
    zip: '97201',
    phone: '(503) 555-0306',
  },
  {
    name: 'Desert Paws Animal Hospital',
    city: 'Phoenix',
    state: 'AZ',
    zip: '85001',
    phone: '(602) 555-0307',
  },
  {
    name: 'Maple Grove Vet Clinic',
    city: 'Minneapolis',
    state: 'MN',
    zip: '55401',
    phone: '(612) 555-0308',
  },
];

const US_STATES = [
  'CA',
  'TX',
  'FL',
  'CO',
  'IL',
  'WA',
  'OR',
  'AZ',
  'MN',
  'GA',
  'NC',
  'VA',
  'OH',
  'PA',
  'MA',
];
const CITIES = [
  'San Francisco',
  'Austin',
  'Miami',
  'Denver',
  'Chicago',
  'Seattle',
  'Portland',
  'Phoenix',
  'Minneapolis',
  'Atlanta',
  'Charlotte',
  'Richmond',
  'Columbus',
  'Philadelphia',
  'Boston',
];

// ── Helpers ─────────────────────────────────────────────────────────
function calculatePlan(billCents: number) {
  const feeCents = Math.round(billCents * PLATFORM_FEE_RATE);
  const totalWithFeeCents = billCents + feeCents;
  const depositCents = Math.round(totalWithFeeCents * 0.25);
  const remainingCents = totalWithFeeCents - depositCents;
  const installmentCents = Math.round(remainingCents / NUM_INSTALLMENTS);
  return { feeCents, totalWithFeeCents, depositCents, remainingCents, installmentCents };
}

/** Seeded random number generator for reproducible data. */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const rand = seededRandom(42);

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function weeksAgo(weeks: number): Date {
  return new Date(now.getTime() - weeks * 7 * DAY_MS);
}

function daysAgo(days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

function ownerEmail(n: number): string {
  return `e2e-owner-${n}@fuzzycatapp.com`;
}

// ── Supabase auth ───────────────────────────────────────────────────
async function createAuthUser(email: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY as string,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      email_confirm: true,
      app_metadata: { role: 'client' },
    }),
  });

  if (res.ok) {
    const data = (await res.json()) as { id: string };
    return data.id;
  }

  const text = await res.text();
  if (res.status === 422 && (text.includes('email_exists') || text.includes('already'))) {
    const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY as string,
      },
    });
    if (listRes.ok) {
      const data = (await listRes.json()) as { users: { id: string; email?: string }[] };
      const existing = data.users.find((u) => u.email === email);
      if (existing) return existing.id;
    }
    return null;
  }

  console.error(`  Failed to create auth user ${email}: ${res.status} ${text}`);
  return null;
}

// ── Step functions ──────────────────────────────────────────────────

async function cleanPreviousDemoData(): Promise<void> {
  console.log('Cleaning previous demo data...');

  const demoOwners = await db
    .select({ id: clients.id })
    .from(clients)
    .where(ilike(clients.email, 'e2e-owner-%@fuzzycatapp.com'));

  if (demoOwners.length > 0) {
    const demoOwnerIds = demoOwners.map((o) => o.id);
    const demoPlans = await db
      .select({ id: plans.id })
      .from(plans)
      .where(inArray(plans.clientId, demoOwnerIds));

    if (demoPlans.length > 0) {
      const demoPlanIds = demoPlans.map((p) => p.id);
      const demoPayments = await db
        .select({ id: payments.id })
        .from(payments)
        .where(inArray(payments.planId, demoPlanIds));
      const demoPaymentIds = demoPayments.map((p) => p.id);

      if (demoPaymentIds.length > 0) {
        await db.delete(payouts).where(inArray(payouts.paymentId, demoPaymentIds));
      }
      await db.delete(softCollections).where(inArray(softCollections.planId, demoPlanIds));
      await db.delete(riskPool).where(inArray(riskPool.planId, demoPlanIds));
      await db.delete(auditLog).where(inArray(auditLog.entityId, demoPlanIds));
      await db.delete(payments).where(inArray(payments.planId, demoPlanIds));
      await db.delete(payouts).where(inArray(payouts.planId, demoPlanIds));
      await db.delete(plans).where(inArray(plans.clientId, demoOwnerIds));
    }

    await db.delete(pets).where(inArray(pets.clientId, demoOwnerIds));
    await db.delete(clients).where(inArray(clients.id, demoOwnerIds));
  }

  await db.delete(clinics).where(ilike(clinics.email, 'demo-%@fuzzycatapp.com'));
  console.log(`  Cleaned ${demoOwners.length} previous demo clients.\n`);
}

async function createAuthAccounts(): Promise<Map<number, string>> {
  console.log('Creating Supabase auth accounts for 50 clients...');
  const authIds = new Map<number, string>();

  for (let i = 1; i <= NUM_OWNERS; i++) {
    const authId = await createAuthUser(ownerEmail(i));
    if (authId) authIds.set(i, authId);
    if (i % 10 === 0) console.log(`  ${i}/${NUM_OWNERS} accounts processed`);
  }

  console.log(`  ${authIds.size} auth accounts ready.\n`);
  return authIds;
}

async function insertDemoClinics(): Promise<string[]> {
  console.log('Inserting 8 demo clinics...');
  const clinicIds: string[] = [];

  for (let ci = 0; ci < CLINIC_DATA.length; ci++) {
    const c = CLINIC_DATA[ci];
    const clinicCreatedAt = daysAgo(randInt(90, 365)); // 3-12 months ago
    const [inserted] = await db
      .insert(clinics)
      .values({
        authId: null, // clinics.auth_id has UNIQUE constraint; admin dashboard shows all clinics
        name: c.name,
        email: `demo-${c.city.toLowerCase().replace(/\s+/g, '-')}@fuzzycatapp.com`,
        phone: c.phone,
        addressLine1: `${randInt(100, 9999)} ${pick(['Main', 'Oak', 'Elm', 'Park', 'First', 'Cedar'])} St`,
        addressCity: c.city,
        addressState: c.state,
        addressZip: c.zip,
        stripeAccountId: `acct_test_demo_${c.city.toLowerCase().replace(/\s+/g, '_')}`,
        status: 'active',
        createdAt: clinicCreatedAt,
        updatedAt: clinicCreatedAt,
      })
      .returning({ id: clinics.id });
    clinicIds.push(inserted.id);
  }

  console.log(`  ${clinicIds.length} clinics created.\n`);
  return clinicIds;
}

async function insertDemoOwners(authIds: Map<number, string>): Promise<string[]> {
  console.log('Inserting 50 demo clients with pets...');
  const clientIds: string[] = [];

  for (let i = 1; i <= NUM_OWNERS; i++) {
    const stateIdx = i % US_STATES.length;
    const ownerCreatedAt = daysAgo(randInt(14, 270)); // 2 weeks to 9 months ago
    const [inserted] = await db
      .insert(clients)
      .values({
        authId: authIds.get(i) ?? null,
        name: `${FIRST_NAMES[i - 1]} ${LAST_NAMES[i - 1]}`,
        email: ownerEmail(i),
        phone: `(555) ${String(i).padStart(3, '0')}-${String(1000 + i).padStart(4, '0')}`,
        addressLine1: `${randInt(100, 9999)} ${pick(['Main', 'Oak', 'Elm', 'Park', 'First'])} St`,
        addressCity: CITIES[stateIdx],
        addressState: US_STATES[stateIdx],
        addressZip: String(10000 + randInt(0, 89999)),
        petName: PET_NAMES[i - 1],
        stripeCustomerId: `cus_test_demo_${i}`,
        paymentMethod: i % 3 === 0 ? 'bank_account' : 'debit_card',
        createdAt: ownerCreatedAt,
        updatedAt: ownerCreatedAt,
      })
      .returning({ id: clients.id });
    clientIds.push(inserted.id);
    await insertPetsForOwner(inserted.id, i);
  }

  console.log(`  ${clientIds.length} clients created with pets.\n`);
  return clientIds;
}

async function insertPetsForOwner(clientId: string, ownerIndex: number): Promise<void> {
  const numPets = randInt(1, 3);
  for (let p = 0; p < numPets; p++) {
    const species = PET_SPECIES[randInt(0, PET_SPECIES.length - 1)];
    const breed =
      species === 'dog' ? pick(DOG_BREEDS) : species === 'cat' ? pick(CAT_BREEDS) : null;
    await db.insert(pets).values({
      clientId,
      name:
        p === 0 ? PET_NAMES[ownerIndex - 1] : PET_NAMES[(ownerIndex + p * 7) % PET_NAMES.length],
      species,
      breed,
      age: randInt(1, 15),
    });
  }
}

function determinePlanPayments(status: PlanStatus, createdWeeksAgo: number) {
  let succeededInstallments = 0;
  let depositPaid = false;

  switch (status) {
    case 'completed':
      depositPaid = true;
      succeededInstallments = NUM_INSTALLMENTS;
      break;
    case 'active':
      depositPaid = true;
      succeededInstallments = Math.min(randInt(0, 5), Math.floor(createdWeeksAgo / 2));
      break;
    case 'pending':
      break;
    case 'defaulted':
      depositPaid = true;
      succeededInstallments = randInt(0, 3);
      break;
    case 'cancelled':
      depositPaid = randInt(0, 1) === 1;
      break;
  }

  return { depositPaid, succeededInstallments };
}

function getInstallmentStatus(
  seq: number,
  succeededInstallments: number,
  status: PlanStatus,
): {
  instStatus: 'succeeded' | 'pending' | 'failed' | 'written_off';
  failureReason: string | null;
  retryCount: number;
} {
  if (seq <= succeededInstallments) {
    return { instStatus: 'succeeded', failureReason: null, retryCount: 0 };
  }
  if (status === 'defaulted' && seq === succeededInstallments + 1) {
    return {
      instStatus: 'failed',
      failureReason: 'ACH returned: Insufficient funds (R01)',
      retryCount: 3,
    };
  }
  if (status === 'cancelled') {
    return { instStatus: 'written_off', failureReason: null, retryCount: 0 };
  }
  return { instStatus: 'pending', failureReason: null, retryCount: 0 };
}

async function createPaymentsForPlan(
  planId: string,
  calc: ReturnType<typeof calculatePlan>,
  startDate: Date,
  depositPaid: boolean,
  succeededInstallments: number,
  status: PlanStatus,
): Promise<{ paymentIds: string[]; count: number }> {
  const paymentIds: string[] = [];
  let count = 0;

  // Deposit
  const depositStatus = depositPaid
    ? 'succeeded'
    : status === 'cancelled'
      ? 'written_off'
      : 'pending';
  const [dep] = await db
    .insert(payments)
    .values({
      planId,
      type: 'deposit',
      sequenceNum: 0,
      amountCents: calc.depositCents,
      status: depositStatus,
      stripePaymentIntentId: depositPaid ? `pi_demo_dep_${planId.slice(0, 8)}` : null,
      scheduledAt: startDate,
      processedAt: depositPaid ? startDate : null,
      createdAt: startDate,
    })
    .returning({ id: payments.id });
  paymentIds.push(dep.id);
  count++;

  // Installments
  for (let seq = 1; seq <= NUM_INSTALLMENTS; seq++) {
    const scheduledAt = new Date(startDate.getTime() + seq * TWO_WEEKS_MS);
    const { instStatus, failureReason, retryCount } = getInstallmentStatus(
      seq,
      succeededInstallments,
      status,
    );

    const [inst] = await db
      .insert(payments)
      .values({
        planId,
        type: 'installment',
        sequenceNum: seq,
        amountCents: calc.installmentCents,
        status: instStatus,
        stripePaymentIntentId:
          instStatus === 'succeeded' ? `pi_demo_inst_${planId.slice(0, 8)}_${seq}` : null,
        scheduledAt,
        processedAt: instStatus === 'succeeded' ? scheduledAt : null,
        failureReason,
        retryCount,
        createdAt: startDate, // payment record created when plan started
      })
      .returning({ id: payments.id });
    paymentIds.push(inst.id);
    count++;
  }

  return { paymentIds, count };
}

async function createPayoutsForPlan(
  clinicId: string,
  planId: string,
  billCents: number,
  calc: ReturnType<typeof calculatePlan>,
  paymentIds: string[],
  depositPaid: boolean,
  succeededInstallments: number,
  startDate: Date,
): Promise<number> {
  const succeededPaymentCount = (depositPaid ? 1 : 0) + succeededInstallments;
  let count = 0;

  for (let i = 0; i < succeededPaymentCount; i++) {
    const amount = i === 0 ? calc.depositCents : calc.installmentCents;
    // Payouts happen 1-3 days after the payment
    const payoutDate = new Date(startDate.getTime() + i * TWO_WEEKS_MS + randInt(1, 3) * DAY_MS);
    await db.insert(payouts).values({
      clinicId,
      planId,
      paymentId: paymentIds[i],
      amountCents: amount,
      clinicShareCents: Math.round(
        billCents * CLINIC_SHARE_RATE * (amount / calc.totalWithFeeCents),
      ),
      stripeTransferId: `tr_demo_${planId.slice(0, 8)}_${i + 1}`,
      status: 'succeeded',
      createdAt: payoutDate,
    });
    count++;
  }

  return count;
}

async function createAuditEntries(
  planId: string,
  billCents: number,
  status: PlanStatus,
  depositPaid: boolean,
  planCreatedAt: Date,
  startDate: Date,
  completedAt: Date | null,
): Promise<void> {
  await db.insert(auditLog).values({
    entityType: 'plan',
    entityId: planId,
    action: 'created',
    oldValue: null,
    newValue: { status: 'pending', totalBillCents: billCents },
    actorType: 'clinic',
    actorId: null,
    createdAt: planCreatedAt,
  });

  if (depositPaid) {
    await db.insert(auditLog).values({
      entityType: 'plan',
      entityId: planId,
      action: 'status_changed',
      oldValue: { status: 'pending' },
      newValue: { status: 'active' },
      actorType: 'system',
      actorId: null,
      createdAt: startDate,
    });
  }

  if (status === 'completed') {
    await db.insert(auditLog).values({
      entityType: 'plan',
      entityId: planId,
      action: 'status_changed',
      oldValue: { status: 'active' },
      newValue: { status },
      actorType: 'system',
      actorId: null,
      createdAt: completedAt ?? startDate,
    });
  }

  if (status === 'defaulted') {
    // Defaulted ~2 weeks after the last successful installment
    const defaultedAt = new Date(startDate.getTime() + 14 * DAY_MS);
    await db.insert(auditLog).values({
      entityType: 'plan',
      entityId: planId,
      action: 'status_changed',
      oldValue: { status: 'active' },
      newValue: { status },
      actorType: 'system',
      actorId: null,
      createdAt: defaultedAt,
    });
  }
}

async function createSoftCollection(planId: string, succeededInstallments: number): Promise<void> {
  const daysIntoCollection = randInt(1, 21);
  let stage: 'day_1_reminder' | 'day_7_followup' | 'day_14_final';
  if (daysIntoCollection <= 6) stage = 'day_1_reminder';
  else if (daysIntoCollection <= 13) stage = 'day_7_followup';
  else stage = 'day_14_final';

  await db.insert(softCollections).values({
    planId,
    stage,
    startedAt: new Date(now.getTime() - daysIntoCollection * DAY_MS),
    lastEscalatedAt: new Date(now.getTime() - Math.min(daysIntoCollection, 7) * DAY_MS),
    nextEscalationAt:
      stage === 'day_14_final'
        ? new Date(now.getTime() + DAY_MS)
        : new Date(now.getTime() + 7 * DAY_MS),
    notes: `Payment failed after ${succeededInstallments} successful installments. ${stage.replace(/_/g, ' ')} stage.`,
  });
}

async function createSinglePlan(
  clientId: string,
  clinicId: string,
  status: PlanStatus,
): Promise<{ payments: number; payouts: number }> {
  const billCents = randInt(10, 300) * 5000;
  const calc = calculatePlan(billCents);
  const createdWeeksAgo = randInt(1, 26);
  const startDate = weeksAgo(createdWeeksAgo);
  const { depositPaid, succeededInstallments } = determinePlanPayments(status, createdWeeksAgo);

  const completedAt =
    status === 'completed' ? new Date(startDate.getTime() + 12 * 7 * DAY_MS) : null;
  const nextPaymentAt =
    status === 'active' && succeededInstallments < NUM_INSTALLMENTS
      ? new Date(startDate.getTime() + (succeededInstallments + 1) * TWO_WEEKS_MS)
      : null;
  const planStatus = status === 'active' && succeededInstallments === 0 ? 'deposit_paid' : status;

  // Plan created a few days before the start date (enrollment processing time)
  const planCreatedAt = new Date(startDate.getTime() - randInt(1, 5) * DAY_MS);

  const [planRow] = await db
    .insert(plans)
    .values({
      clientId,
      clinicId,
      totalBillCents: billCents,
      ...calc,
      numInstallments: NUM_INSTALLMENTS,
      status: planStatus,
      depositPaidAt: depositPaid ? startDate : null,
      completedAt,
      nextPaymentAt,
      createdAt: planCreatedAt,
      updatedAt: completedAt ?? (depositPaid ? startDate : planCreatedAt),
    })
    .returning({ id: plans.id });

  const { paymentIds, count: pmtCount } = await createPaymentsForPlan(
    planRow.id,
    calc,
    startDate,
    depositPaid,
    succeededInstallments,
    status,
  );

  const payoutCnt = await createPayoutsForPlan(
    clinicId,
    planRow.id,
    billCents,
    calc,
    paymentIds,
    depositPaid,
    succeededInstallments,
    startDate,
  );

  if (status !== 'cancelled' && status !== 'pending') {
    await db.insert(riskPool).values({
      planId: planRow.id,
      contributionCents: Math.round(calc.totalWithFeeCents * PLATFORM_RESERVE_RATE),
      type: 'contribution',
      createdAt: startDate,
    });
  }

  await createAuditEntries(
    planRow.id,
    billCents,
    status,
    depositPaid,
    planCreatedAt,
    startDate,
    completedAt,
  );

  if (status === 'defaulted') {
    await createSoftCollection(planRow.id, succeededInstallments);
  }

  return { payments: pmtCount, payouts: payoutCnt };
}

function buildPlanAssignments(): { clientIdx: number; status: PlanStatus }[] {
  const statusPool: PlanStatus[] = [
    ...Array<PlanStatus>(30).fill('active'),
    ...Array<PlanStatus>(22).fill('completed'),
    ...Array<PlanStatus>(8).fill('pending'),
    ...Array<PlanStatus>(11).fill('defaulted'),
    ...Array<PlanStatus>(4).fill('cancelled'),
  ];

  const assignments: { clientIdx: number; status: PlanStatus }[] = [];
  for (let i = 0; i < statusPool.length; i++) {
    assignments.push({ clientIdx: i % NUM_OWNERS, status: statusPool[i] });
  }

  for (let i = assignments.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [assignments[i], assignments[j]] = [assignments[j], assignments[i]];
  }

  return assignments;
}

async function generatePlans(clientIds: string[], allClinicIds: string[]): Promise<void> {
  console.log('Generating ~75 plans...');

  const planAssignments = buildPlanAssignments();
  let planCount = 0;
  let paymentCount = 0;
  let payoutCount = 0;

  for (const assignment of planAssignments) {
    const clientId = clientIds[assignment.clientIdx];
    const clinicId = allClinicIds[randInt(0, allClinicIds.length - 1)];
    const counts = await createSinglePlan(clientId, clinicId, assignment.status);
    planCount++;
    paymentCount += counts.payments;
    payoutCount += counts.payouts;
  }

  console.log(`  ${planCount} plans created`);
  console.log(`  ${paymentCount} payments created`);
  console.log(`  ${payoutCount} payouts created\n`);
}

async function printSummary(): Promise<void> {
  const totalClinics = await db.select({ count: sql<number>`count(*)` }).from(clinics);
  const totalOwners = await db.select({ count: sql<number>`count(*)` }).from(clients);
  const totalPlans = await db.select({ count: sql<number>`count(*)` }).from(plans);
  const totalPayments = await db.select({ count: sql<number>`count(*)` }).from(payments);

  console.log('=== Demo Seed Complete ===');
  console.log(`  Total clinics:  ${totalClinics[0].count}`);
  console.log(`  Total clients:   ${totalOwners[0].count}`);
  console.log(`  Total plans:    ${totalPlans[0].count}`);
  console.log(`  Total payments: ${totalPayments[0].count}`);
  console.log(`\nDemo clients: e2e-owner-1@fuzzycatapp.com through e2e-owner-50@fuzzycatapp.com`);
  console.log('Password: (E2E_TEST_PASSWORD from .env.local)');
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log('=== FuzzyCat Demo Data Seeder ===\n');

  const [clinicRow] = await db
    .select({ id: clinics.id, authId: clinics.authId })
    .from(clinics)
    .where(eq(clinics.email, CLINIC_EMAIL))
    .limit(1);

  if (!clinicRow?.authId) {
    console.error(`Clinic ${CLINIC_EMAIL} not found or has no authId.`);
    console.error('Run `bun run e2e:setup-users` first.');
    process.exit(1);
  }

  console.log(`Using clinic auth ID: ${clinicRow.authId}\n`);

  await cleanPreviousDemoData();
  const authIds = await createAuthAccounts();
  const clinicIds = await insertDemoClinics();
  const allClinicIds = [clinicRow.id, ...clinicIds];
  const clientIds = await insertDemoOwners(authIds);
  await generatePlans(clientIds, allClinicIds);
  await printSummary();
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('Demo seed failed:', error);
    process.exit(1);
  });
