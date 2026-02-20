/**
 * Shared schema mock for Stripe service tests.
 *
 * Bun's mock.module is global per test run, so every test file that mocks
 * @/server/db/schema must export ALL named exports the real schema provides.
 * Otherwise, a test file that only exports `payments` will break another
 * file that needs `owners`.
 */
export const schemaMock = {
  owners: { id: 'owners.id', stripeCustomerId: 'owners.stripe_customer_id' },
  clinics: { id: 'clinics.id' },
  plans: { id: 'plans.id' },
  payments: { id: 'payments.id', stripePaymentIntentId: 'payments.stripe_payment_intent_id' },
  payouts: { id: 'payouts.id' },
  auditLog: { id: 'auditLog.id' },
  riskPool: { id: 'riskPool.id' },
  clinicStatusEnum: {},
  paymentMethodEnum: {},
  planStatusEnum: {},
  paymentTypeEnum: {},
  paymentStatusEnum: {},
  payoutStatusEnum: {},
  riskPoolTypeEnum: {},
  actorTypeEnum: {},
  clinicsRelations: {},
  ownersRelations: {},
  plansRelations: {},
  paymentsRelations: {},
  payoutsRelations: {},
  riskPoolRelations: {},
};
