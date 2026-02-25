/**
 * Shared deterministic UUIDs for seed data.
 * Used by scripts/seed.ts and scripts/seed-soft-collections.ts.
 */

// ── Clinics ──────────────────────────────────────────────────────────
export const CLINIC_1_ID = '00000000-0000-4000-a000-000000000001';
export const CLINIC_2_ID = '00000000-0000-4000-a000-000000000002';

// ── Owners ───────────────────────────────────────────────────────────
export const OWNER_1_ID = '00000000-0000-4000-b000-000000000001';
export const OWNER_2_ID = '00000000-0000-4000-b000-000000000002';
export const OWNER_3_ID = '00000000-0000-4000-b000-000000000003';

// ── Auth IDs (not real Supabase user IDs) ────────────────────────────
export const CLINIC_1_AUTH_ID = '00000000-0000-4000-f000-000000000001';
export const CLINIC_2_AUTH_ID = '00000000-0000-4000-f000-000000000002';
export const OWNER_1_AUTH_ID = '00000000-0000-4000-f000-000000000011';
export const OWNER_2_AUTH_ID = '00000000-0000-4000-f000-000000000012';
export const OWNER_3_AUTH_ID = '00000000-0000-4000-f000-000000000013';

// ── Plans ────────────────────────────────────────────────────────────
export const PLAN_1_ID = '00000000-0000-4000-c000-000000000001'; // Active $1,200 plan (Alice/Whiskers)
export const PLAN_2_ID = '00000000-0000-4000-c000-000000000002'; // Pending $800 plan (Bob/Mittens)
export const PLAN_3_ID = '00000000-0000-4000-c000-000000000003'; // Completed $2,500 plan (Carol/Luna)

// ── Payments ─────────────────────────────────────────────────────────
export const PAYMENT_1_DEPOSIT_ID = '00000000-0000-4000-d000-000000000001';
export const PAYMENT_1_INST_1_ID = '00000000-0000-4000-d000-000000000002';
export const PAYMENT_1_INST_2_ID = '00000000-0000-4000-d000-000000000003';
export const PAYMENT_1_INST_3_ID = '00000000-0000-4000-d000-000000000004';
export const PAYMENT_1_INST_4_ID = '00000000-0000-4000-d000-000000000005';
export const PAYMENT_1_INST_5_ID = '00000000-0000-4000-d000-000000000006';
export const PAYMENT_1_INST_6_ID = '00000000-0000-4000-d000-000000000007';

// ── Payouts ──────────────────────────────────────────────────────────
export const PAYOUT_1_ID = '00000000-0000-4000-e000-000000000001';
export const PAYOUT_2_ID = '00000000-0000-4000-e000-000000000002';
export const PAYOUT_3_ID = '00000000-0000-4000-e000-000000000003';

// ── Seed bill amounts (cents) ────────────────────────────────────────
export const PLAN_1_BILL_CENTS = 120_000; // $1,200
export const PLAN_2_BILL_CENTS = 80_000; // $800
export const PLAN_3_BILL_CENTS = 250_000; // $2,500
