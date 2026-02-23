/**
 * Shared schema mock for Stripe service tests.
 *
 * Bun's mock.module is global per test run, so every test file that mocks
 * @/server/db/schema must export ALL named exports the real schema provides.
 * Otherwise, a test file that only exports `payments` will break another
 * file that needs `owners`.
 */
export const schemaMock = {
  owners: {
    id: 'owners.id',
    stripeCustomerId: 'owners.stripe_customer_id',
    stripeCardPaymentMethodId: 'owners.stripe_card_payment_method_id',
    stripeAchPaymentMethodId: 'owners.stripe_ach_payment_method_id',
    plaidAccessToken: 'owners.plaid_access_token',
    plaidItemId: 'owners.plaid_item_id',
    plaidAccountId: 'owners.plaid_account_id',
  },
  clinics: { id: 'clinics.id' },
  plans: { id: 'plans.id', status: 'plans.status', remainingCents: 'plans.remaining_cents' },
  payments: { id: 'payments.id', stripePaymentIntentId: 'payments.stripe_payment_intent_id' },
  payouts: { id: 'payouts.id' },
  auditLog: {
    id: 'auditLog.id',
    entityType: 'auditLog.entity_type',
    entityId: 'auditLog.entity_id',
    createdAt: 'auditLog.created_at',
  },
  riskPool: {
    id: 'riskPool.id',
    type: 'riskPool.type',
    contributionCents: 'riskPool.contribution_cents',
  },
  softCollections: {
    id: 'soft_collections.id',
    planId: 'soft_collections.plan_id',
    stage: 'soft_collections.stage',
    startedAt: 'soft_collections.started_at',
    lastEscalatedAt: 'soft_collections.last_escalated_at',
    nextEscalationAt: 'soft_collections.next_escalation_at',
    notes: 'soft_collections.notes',
    createdAt: 'soft_collections.created_at',
    updatedAt: 'soft_collections.updated_at',
  },
  clinicStatusEnum: {},
  paymentMethodEnum: {},
  planStatusEnum: {},
  paymentTypeEnum: {},
  paymentStatusEnum: {},
  payoutStatusEnum: {},
  riskPoolTypeEnum: {},
  actorTypeEnum: {},
  softCollectionStageEnum: {},
  clinicsRelations: {},
  ownersRelations: {},
  plansRelations: {},
  paymentsRelations: {},
  payoutsRelations: {},
  riskPoolRelations: {},
  softCollectionsRelations: {},
};
