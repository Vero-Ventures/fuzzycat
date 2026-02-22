import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  inet,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// ── Enums ───────────────────────────────────────────────────────────
export const clinicStatusEnum = pgEnum('clinic_status', ['pending', 'active', 'suspended']);
export const paymentMethodEnum = pgEnum('payment_method', ['debit_card', 'bank_account']);
export const planStatusEnum = pgEnum('plan_status', [
  'pending',
  'deposit_paid',
  'active',
  'completed',
  'defaulted',
  'cancelled',
]);
export const paymentTypeEnum = pgEnum('payment_type', ['deposit', 'installment']);
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'processing',
  'succeeded',
  'failed',
  'retried',
  'written_off',
]);
export const payoutStatusEnum = pgEnum('payout_status', ['pending', 'succeeded', 'failed']);
export const riskPoolTypeEnum = pgEnum('risk_pool_type', ['contribution', 'claim', 'recovery']);
export const actorTypeEnum = pgEnum('actor_type', ['system', 'admin', 'owner', 'clinic']);
export const softCollectionStageEnum = pgEnum('soft_collection_stage', [
  'day_1_reminder',
  'day_7_followup',
  'day_14_final',
  'completed',
  'cancelled',
]);

// ── Veterinary clinics ──────────────────────────────────────────────
export const clinics = pgTable('clinics', {
  id: uuid('id').primaryKey().defaultRandom(),
  authId: text('auth_id').unique(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull().unique(),
  addressLine1: text('address_line1'),
  addressCity: text('address_city'),
  addressState: text('address_state').notNull(),
  addressZip: text('address_zip').notNull(),
  stripeAccountId: text('stripe_account_id'),
  status: clinicStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ── Pet owners ──────────────────────────────────────────────────────
export const owners = pgTable('owners', {
  id: uuid('id').primaryKey().defaultRandom(),
  authId: text('auth_id').unique(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone').notNull(),
  addressLine1: text('address_line1'),
  addressCity: text('address_city'),
  addressState: text('address_state'),
  addressZip: text('address_zip'),
  petName: text('pet_name').notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  plaidAccessToken: text('plaid_access_token'),
  plaidItemId: text('plaid_item_id'),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ── Payment plans (one per enrollment) ──────────────────────────────
export const plans = pgTable(
  'plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id').references(() => owners.id),
    clinicId: uuid('clinic_id').references(() => clinics.id),
    totalBillCents: integer('total_bill_cents').notNull(),
    feeCents: integer('fee_cents').notNull(),
    totalWithFeeCents: integer('total_with_fee_cents').notNull(),
    depositCents: integer('deposit_cents').notNull(),
    remainingCents: integer('remaining_cents').notNull(),
    installmentCents: integer('installment_cents').notNull(),
    numInstallments: integer('num_installments').notNull().default(6),
    status: planStatusEnum('status').notNull().default('pending'),
    depositPaidAt: timestamp('deposit_paid_at', { withTimezone: true }),
    nextPaymentAt: timestamp('next_payment_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('idx_plans_clinic').on(table.clinicId),
    index('idx_plans_owner').on(table.ownerId),
    index('idx_plans_status').on(table.status),
  ],
);

// ── Individual payments (deposit + each installment) ────────────────
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id').references(() => plans.id),
    type: paymentTypeEnum('type').notNull(),
    sequenceNum: integer('sequence_num'),
    amountCents: integer('amount_cents').notNull(),
    status: paymentStatusEnum('status').notNull().default('pending'),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    failureReason: text('failure_reason'),
    retryCount: integer('retry_count').default(0),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('idx_payments_plan').on(table.planId),
    index('idx_payments_scheduled').on(table.scheduledAt),
    index('idx_payments_status').on(table.status),
    unique('uq_payments_plan_sequence').on(table.planId, table.sequenceNum),
    check('ck_payments_amount_positive', sql`${table.amountCents} > 0`),
  ],
);

// ── Clinic payouts ──────────────────────────────────────────────────
export const payouts = pgTable(
  'payouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id').references(() => clinics.id),
    planId: uuid('plan_id').references(() => plans.id),
    paymentId: uuid('payment_id').references(() => payments.id),
    amountCents: integer('amount_cents').notNull(),
    clinicShareCents: integer('clinic_share_cents').notNull(),
    stripeTransferId: text('stripe_transfer_id'),
    status: payoutStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_payouts_clinic').on(table.clinicId),
    check('ck_payouts_amount_positive', sql`${table.amountCents} > 0`),
  ],
);

// ── Risk pool (guarantee fund) ──────────────────────────────────────
export const riskPool = pgTable('risk_pool', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id').references(() => plans.id),
  contributionCents: integer('contribution_cents').notNull(),
  type: riskPoolTypeEnum('type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ── Soft collections (post-default recovery) ────────────────────────
export const softCollections = pgTable(
  'soft_collections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .references(() => plans.id)
      .unique()
      .notNull(),
    stage: softCollectionStageEnum('stage').notNull().default('day_1_reminder'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    lastEscalatedAt: timestamp('last_escalated_at', { withTimezone: true }),
    nextEscalationAt: timestamp('next_escalation_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('idx_soft_collections_plan').on(table.planId),
    index('idx_soft_collections_stage').on(table.stage),
    index('idx_soft_collections_next_escalation').on(table.nextEscalationAt),
  ],
);

// ── Audit log (MANDATORY for compliance) ────────────────────────────
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    action: text('action').notNull(),
    oldValue: jsonb('old_value'),
    newValue: jsonb('new_value'),
    actorType: actorTypeEnum('actor_type').notNull(),
    actorId: uuid('actor_id'),
    ipAddress: inet('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_audit_entity').on(table.entityType, table.entityId)],
);

// ── Relations (for db.query API — no SQL impact) ────────────────────

export const clinicsRelations = relations(clinics, ({ many }) => ({
  plans: many(plans),
  payouts: many(payouts),
}));

export const ownersRelations = relations(owners, ({ many }) => ({
  plans: many(plans),
}));

export const plansRelations = relations(plans, ({ one, many }) => ({
  owner: one(owners, { fields: [plans.ownerId], references: [owners.id] }),
  clinic: one(clinics, { fields: [plans.clinicId], references: [clinics.id] }),
  payments: many(payments),
  payouts: many(payouts),
  riskPoolEntries: many(riskPool),
  softCollection: one(softCollections, {
    fields: [plans.id],
    references: [softCollections.planId],
  }),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  plan: one(plans, { fields: [payments.planId], references: [plans.id] }),
  payouts: many(payouts),
}));

export const payoutsRelations = relations(payouts, ({ one }) => ({
  clinic: one(clinics, { fields: [payouts.clinicId], references: [clinics.id] }),
  plan: one(plans, { fields: [payouts.planId], references: [plans.id] }),
  payment: one(payments, { fields: [payouts.paymentId], references: [payments.id] }),
}));

export const riskPoolRelations = relations(riskPool, ({ one }) => ({
  plan: one(plans, { fields: [riskPool.planId], references: [plans.id] }),
}));

export const softCollectionsRelations = relations(softCollections, ({ one }) => ({
  plan: one(plans, { fields: [softCollections.planId], references: [plans.id] }),
}));
