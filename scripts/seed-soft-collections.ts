/**
 * Seed soft_collections with realistic data for all 3 plan scenarios.
 * Run after scripts/seed.ts to add soft collection records.
 */
import { db } from '@/server/db';
import { softCollections } from '@/server/db/schema';

const PLAN_1_ID = '00000000-0000-4000-c000-000000000001'; // Active $1,200 plan (Alice/Whiskers)
const PLAN_2_ID = '00000000-0000-4000-c000-000000000002'; // Pending $800 plan (Bob/Mittens)
const PLAN_3_ID = '00000000-0000-4000-c000-000000000003'; // Completed $2,500 plan (Carol/Luna)

const now = new Date();
const day = 24 * 60 * 60 * 1000;

async function seedSoftCollections() {
  console.log('Seeding soft collections...');

  await db.insert(softCollections).values([
    {
      // Alice missed installment 3 — day 1 reminder sent, escalation due in 6 days
      planId: PLAN_1_ID,
      stage: 'day_1_reminder',
      startedAt: new Date(now.getTime() - 1 * day),
      lastEscalatedAt: new Date(now.getTime() - 1 * day),
      nextEscalationAt: new Date(now.getTime() + 6 * day),
      notes: 'Installment #3 failed — ACH returned NSF. Day 1 friendly reminder sent via email.',
    },
    {
      // Bob's deposit never came through — 2 weeks into soft collection, final warning stage
      planId: PLAN_2_ID,
      stage: 'day_14_final',
      startedAt: new Date(now.getTime() - 14 * day),
      lastEscalatedAt: new Date(now.getTime() - 7 * day),
      nextEscalationAt: new Date(now.getTime() + 1 * day),
      notes:
        'Deposit payment failed 3x. Day 7 follow-up sent. Final notice pending — will default if unresolved.',
    },
    {
      // Carol's plan recovered — soft collection completed successfully
      planId: PLAN_3_ID,
      stage: 'completed',
      startedAt: new Date(now.getTime() - 21 * day),
      lastEscalatedAt: new Date(now.getTime() - 10 * day),
      nextEscalationAt: null,
      notes:
        'Owner responded at day 7 follow-up. Updated bank account and payment succeeded. Collection resolved.',
    },
  ]);

  console.log('Soft collections seeded:');
  console.log(
    '  - Plan 1 (Alice/$1,200): day_1_reminder — just started, next escalation in 6 days',
  );
  console.log('  - Plan 2 (Bob/$800): day_14_final — critical, final warning before default');
  console.log('  - Plan 3 (Carol/$2,500): completed — successfully recovered');
}

seedSoftCollections()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
