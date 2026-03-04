import { relations, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
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
export const actorTypeEnum = pgEnum('actor_type', ['system', 'admin', 'owner', 'clinic', 'client']);
export const softCollectionStageEnum = pgEnum('soft_collection_stage', [
  'day_1_reminder',
  'day_7_followup',
  'day_14_final',
  'completed',
  'cancelled',
]);
export const webhookDeliveryStatusEnum = pgEnum('webhook_delivery_status', [
  'pending',
  'succeeded',
  'failed',
]);
export const referralStatusEnum = pgEnum('referral_status', ['pending', 'converted', 'expired']);

// ── Veterinary clinics ──────────────────────────────────────────────
export const clinics = pgTable(
  'clinics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authId: text('auth_id').unique(),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    email: text('email').notNull().unique(),
    addressLine1: text('address_line1'),
    addressCity: text('address_city'),
    addressState: text('address_state').notNull(),
    addressZip: text('address_zip').notNull(),
    stripeAccountId: text('stripe_account_id').unique(),
    status: clinicStatusEnum('status').notNull().default('pending'),
    revenueShareBps: integer('revenue_share_bps').notNull().default(300),
    foundingClinic: boolean('founding_clinic').notNull().default(false),
    foundingExpiresAt: timestamp('founding_expires_at', { withTimezone: true }),
    referralCode: text('referral_code').unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_clinics_stripe_account').on(table.stripeAccountId)],
);

// ── Pet clients (formerly "owners") ─────────────────────────────────
export const clients = pgTable('clients', {
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
  // Legacy columns — kept for backward compat (Phase 1A migration)
  stripeCardPaymentMethodId: text('stripe_card_payment_method_id'),
  stripeAchPaymentMethodId: text('stripe_ach_payment_method_id'),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  // Multi-payment-method support (Phase 1A)
  primaryPaymentMethodId: uuid('primary_payment_method_id').references(
    (): AnyPgColumn => paymentMethods.id,
  ),
  secondaryPaymentMethodId: uuid('secondary_payment_method_id').references(
    (): AnyPgColumn => paymentMethods.id,
  ),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ── Payment methods (multi-method support) ──────────────────────────
export const paymentMethods = pgTable(
  'payment_methods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .references(() => clients.id)
      .notNull(),
    type: paymentMethodEnum('type').notNull(),
    stripePaymentMethodId: text('stripe_payment_method_id').notNull(),
    label: text('label'), // user-friendly name
    last4: text('last4').notNull(),
    brand: text('brand'), // visa, mastercard, etc (cards only)
    bankName: text('bank_name'), // (banks only)
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_payment_methods_client').on(table.clientId),
    index('idx_payment_methods_stripe').on(table.stripePaymentMethodId),
  ],
);

// ── Pets ─────────────────────────────────────────────────────────────
export const pets = pgTable(
  'pets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .references(() => clients.id)
      .notNull(),
    name: text('name').notNull(),
    species: text('species').notNull(), // 'dog', 'cat', 'other'
    breed: text('breed'),
    age: integer('age'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('idx_pets_client').on(table.clientId)],
);

// ── Payment plans (one per enrollment) ──────────────────────────────
export const plans = pgTable(
  'plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id').references(() => clients.id),
    clinicId: uuid('clinic_id').references(() => clinics.id),
    totalBillCents: integer('total_bill_cents').notNull(),
    feeCents: integer('fee_cents').notNull(),
    totalWithFeeCents: integer('total_with_fee_cents').notNull(),
    depositCents: integer('deposit_cents').notNull(),
    remainingCents: integer('remaining_cents').notNull(),
    installmentCents: integer('installment_cents').notNull(),
    numInstallments: integer('num_installments').notNull().default(6),
    status: planStatusEnum('status').notNull().default('pending'),
    referralDiscountCents: integer('referral_discount_cents').default(0),
    clientReferralId: uuid('client_referral_id'),
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
    index('idx_plans_client').on(table.clientId),
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
    index('idx_payments_stripe_pi').on(table.stripePaymentIntentId),
    index('idx_payments_due').on(table.scheduledAt, table.status, table.type),
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
    index('idx_payouts_plan').on(table.planId),
    index('idx_payouts_payment').on(table.paymentId),
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

// ── API keys (external REST API authentication) ─────────────────────
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .references(() => clinics.id)
      .notNull(),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull(),
    keyPrefix: text('key_prefix').notNull(),
    permissions: text('permissions').array().notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    allowedIps: text('allowed_ips').array(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_api_keys_clinic').on(table.clinicId),
    index('idx_api_keys_hash').on(table.keyHash),
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
  (table) => [
    index('idx_audit_entity').on(table.entityType, table.entityId),
    index('idx_audit_actor').on(table.actorId),
  ],
);

// ── Idempotency keys (API request deduplication) ─────────────────────
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .references(() => clinics.id)
      .notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    httpMethod: text('http_method').notNull(),
    httpPath: text('http_path').notNull(),
    responseStatus: integer('response_status').notNull(),
    responseBody: jsonb('response_body'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    unique('uq_idempotency_clinic_key').on(table.clinicId, table.idempotencyKey),
    index('idx_idempotency_expires').on(table.expiresAt),
  ],
);

// ── Webhook endpoints (clinic-registered callback URLs) ──────────────
export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .references(() => clinics.id)
      .notNull(),
    url: text('url').notNull(),
    secret: text('secret').notNull(), // HMAC signing secret
    events: text('events').array().notNull(), // e.g. ['enrollment.created', 'payment.succeeded']
    enabled: boolean('enabled').notNull().default(true),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('idx_webhook_endpoints_clinic').on(table.clinicId)],
);

// ── Webhook deliveries (delivery attempt log) ────────────────────────
export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    endpointId: uuid('endpoint_id')
      .references(() => webhookEndpoints.id)
      .notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    status: webhookDeliveryStatusEnum('status').notNull().default('pending'),
    httpStatus: integer('http_status'),
    responseBody: text('response_body'),
    attempts: integer('attempts').notNull().default(0),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_webhook_deliveries_endpoint').on(table.endpointId),
    index('idx_webhook_deliveries_status').on(table.status),
    index('idx_webhook_deliveries_retry').on(table.nextRetryAt),
  ],
);

// ── Clinic requests (client waitlist) ─────────────────────────────────
export const clinicRequests = pgTable(
  'clinic_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientEmail: text('client_email').notNull(),
    clientName: text('client_name'),
    clinicName: text('clinic_name').notNull(),
    clinicCity: text('clinic_city'),
    clinicState: text('clinic_state'),
    clinicZip: text('clinic_zip'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_clinic_requests_email').on(table.clientEmail)],
);

// ── Clinic referrals (clinic-to-clinic) ──────────────────────────────
export const clinicReferrals = pgTable(
  'clinic_referrals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    referrerClinicId: uuid('referrer_clinic_id')
      .references(() => clinics.id)
      .notNull(),
    referredClinicId: uuid('referred_clinic_id').references(() => clinics.id),
    referredEmail: text('referred_email').notNull(),
    referralCode: text('referral_code').notNull(),
    status: referralStatusEnum('status').notNull().default('pending'),
    convertedAt: timestamp('converted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_clinic_referrals_referrer').on(table.referrerClinicId),
    index('idx_clinic_referrals_code').on(table.referralCode),
  ],
);

// ── Client referrals (client-to-client) ──────────────────────────────
export const clientReferrals = pgTable(
  'client_referrals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    referrerClientId: uuid('referrer_client_id')
      .references(() => clients.id)
      .notNull(),
    referredClientId: uuid('referred_client_id').references(() => clients.id),
    referralCode: text('referral_code').notNull().unique(),
    status: referralStatusEnum('status').notNull().default('pending'),
    creditApplied: boolean('credit_applied').notNull().default(false),
    convertedAt: timestamp('converted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_client_referrals_referrer').on(table.referrerClientId),
    index('idx_client_referrals_code').on(table.referralCode),
  ],
);

// ── Relations (for db.query API — no SQL impact) ────────────────────

export const clinicsRelations = relations(clinics, ({ many }) => ({
  plans: many(plans),
  payouts: many(payouts),
  apiKeys: many(apiKeys),
  webhookEndpoints: many(webhookEndpoints),
  clinicReferrals: many(clinicReferrals),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  plans: many(plans),
  pets: many(pets),
  paymentMethods: many(paymentMethods),
  clientReferrals: many(clientReferrals),
}));

export const paymentMethodsRelations = relations(paymentMethods, ({ one }) => ({
  client: one(clients, { fields: [paymentMethods.clientId], references: [clients.id] }),
}));

export const petsRelations = relations(pets, ({ one }) => ({
  client: one(clients, { fields: [pets.clientId], references: [clients.id] }),
}));

export const plansRelations = relations(plans, ({ one, many }) => ({
  client: one(clients, { fields: [plans.clientId], references: [clients.id] }),
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

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  clinic: one(clinics, { fields: [apiKeys.clinicId], references: [clinics.id] }),
}));

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one, many }) => ({
  clinic: one(clinics, { fields: [webhookEndpoints.clinicId], references: [clinics.id] }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  endpoint: one(webhookEndpoints, {
    fields: [webhookDeliveries.endpointId],
    references: [webhookEndpoints.id],
  }),
}));

export const clinicReferralsRelations = relations(clinicReferrals, ({ one }) => ({
  referrerClinic: one(clinics, {
    fields: [clinicReferrals.referrerClinicId],
    references: [clinics.id],
  }),
}));

export const clientReferralsRelations = relations(clientReferrals, ({ one }) => ({
  referrerClient: one(clients, {
    fields: [clientReferrals.referrerClientId],
    references: [clients.id],
  }),
}));
