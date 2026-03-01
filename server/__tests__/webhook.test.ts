import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockConstructEvent = mock();
const mockPaymentIntentRetrieve = mock();

mock.module('@/lib/stripe', () => ({
  stripe: () => ({
    webhooks: { constructEvent: mockConstructEvent },
    transfers: { create: mock(() => Promise.resolve({ id: 'tr_test' })) },
    paymentIntents: { retrieve: mockPaymentIntentRetrieve },
    customers: { update: mock(() => Promise.resolve({})) },
  }),
}));

mock.module('@/lib/logger', () => ({
  logger: {
    info: mock(),
    warn: mock(),
    error: mock(),
  },
}));

// Set env vars so serverEnv() validates successfully when the route imports it.
// We do NOT mock @/lib/env to avoid contaminating other test files that import
// validateEnv (Bun's mock.module is global per test run).
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
process.env.STRIPE_SECRET_KEY = 'sk_test_abc123';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
process.env.TWILIO_ACCOUNT_SID = 'ACtest1234567890abcdef1234567890ab';
process.env.TWILIO_AUTH_TOKEN = 'test-twilio-auth-token';
process.env.TWILIO_PHONE_NUMBER = '+15551234567';
process.env.RESEND_API_KEY = 're_test_abc123';
process.env.PLAID_CLIENT_ID = 'test-plaid-client-id';
process.env.PLAID_SECRET = 'test-plaid-secret';
process.env.PLAID_ENV = 'sandbox';
process.env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';
process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '1x00000000000000000000AA';

const mockSelectFrom = mock();
const mockSelectWhere = mock();
const mockSelectLimit = mock();
const mockSelect = mock();

const mockUpdateSet = mock();
const mockUpdateWhere = mock();
const mockUpdate = mock();

const mockInsertValues = mock();
const mockInsertReturning = mock();
const mockInsert = mock();

// Transaction mock (used by payment service functions)
const mockTxSelectLimit = mock();
const mockTxSelectWhere = mock();
const mockTxSelectFrom = mock();
const mockTxSelect = mock();
const mockTxUpdateSet = mock();
const mockTxUpdateWhere = mock();
const mockTxUpdate = mock();
const mockTxInsertValues = mock();
const mockTxInsert = mock();

const mockTransaction = mock(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
  const tx = {
    select: mockTxSelect,
    update: mockTxUpdate,
    insert: mockTxInsert,
  };
  mockTxSelectLimit.mockReturnValue([]);
  mockTxSelectWhere.mockReturnValue({ limit: mockTxSelectLimit });
  mockTxSelectFrom.mockReturnValue({
    where: mockTxSelectWhere,
    leftJoin: () => ({ where: mockTxSelectWhere }),
  });
  mockTxSelect.mockReturnValue({ from: mockTxSelectFrom });

  mockTxUpdateWhere.mockResolvedValue([]);
  mockTxUpdateSet.mockReturnValue({ where: mockTxUpdateWhere });
  mockTxUpdate.mockReturnValue({ set: mockTxUpdateSet });

  mockTxInsertValues.mockResolvedValue([]);
  mockTxInsert.mockReturnValue({ values: mockTxInsertValues });

  return fn(tx);
});

mock.module('@/server/db', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
    transaction: mockTransaction,
    query: {
      payments: { findFirst: mock(() => Promise.resolve(null)) },
      payouts: { findFirst: mock(() => Promise.resolve(null)) },
    },
  },
}));

mock.module('@/server/db/schema', () => ({
  owners: {
    id: 'owners.id',
    stripeCustomerId: 'owners.stripe_customer_id',
    stripeCardPaymentMethodId: 'owners.stripe_card_payment_method_id',
    stripeAchPaymentMethodId: 'owners.stripe_ach_payment_method_id',
  },
  clinics: {
    id: 'clinics.id',
    stripeAccountId: 'clinics.stripe_account_id',
    status: 'clinics.status',
  },
  plans: {
    id: 'plans.id',
    status: 'plans.status',
    clinicId: 'plans.clinic_id',
    ownerId: 'plans.owner_id',
    totalBillCents: 'plans.total_bill_cents',
    depositCents: 'plans.deposit_cents',
    remainingCents: 'plans.remaining_cents',
  },
  payments: {
    id: 'payments.id',
    status: 'payments.status',
    planId: 'payments.plan_id',
    amountCents: 'payments.amount_cents',
    type: 'payments.type',
    stripePaymentIntentId: 'payments.stripe_payment_intent_id',
    retryCount: 'payments.retry_count',
    sequenceNum: 'payments.sequence_num',
    scheduledAt: 'payments.scheduled_at',
  },
  payouts: { id: 'payouts.id', paymentId: 'payouts.payment_id' },
  auditLog: {
    id: 'auditLog.id',
    entityType: 'auditLog.entity_type',
    entityId: 'auditLog.entity_id',
    createdAt: 'auditLog.created_at',
  },
  riskPool: { id: 'riskPool.id' },
  clinicStatusEnum: {},
  paymentMethodEnum: {},
  planStatusEnum: {},
  paymentTypeEnum: {},
  paymentStatusEnum: {},
  payoutStatusEnum: {},
  pets: { id: 'pets.id', ownerId: 'pets.owner_id' },
  riskPoolTypeEnum: {},
  actorTypeEnum: {},
  clinicsRelations: {},
  ownersRelations: {},
  petsRelations: {},
  plansRelations: {},
  paymentsRelations: {},
  payoutsRelations: {},
  riskPoolRelations: {},
  softCollections: {
    id: 'soft_collections.id',
    planId: 'soft_collections.plan_id',
    stage: 'soft_collections.stage',
    nextEscalationAt: 'soft_collections.next_escalation_at',
  },
}));

import { createAuditMock } from './audit-mock';

mock.module('@/server/services/audit', () => createAuditMock(mockInsert));

mock.module('drizzle-orm', () => ({
  eq: (col: string, val: string) => ({ col, val, type: 'eq' }),
  and: (...args: unknown[]) => ({ args, type: 'and' }),
  desc: (col: string) => ({ col, type: 'desc' }),
  lte: (col: string, val: unknown) => ({ col, val, type: 'lte' }),
  inArray: (col: string, vals: unknown[]) => ({ col, vals, type: 'inArray' }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings: [...strings],
    values,
    type: 'sql',
  }),
}));

mock.module('drizzle-orm/pg-core', () => ({
  PgTransaction: class {},
}));

const { POST } = await import('@/app/api/webhooks/stripe/route');

// ── Helpers ──────────────────────────────────────────────────────────

function makeRequest(body: string, signature = 'sig_test_valid') {
  return new Request('https://app.example.com/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers: { 'stripe-signature': signature },
  });
}

function stripeEvent(type: string, data: Record<string, unknown>) {
  return { type, data: { object: data } };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Stripe webhook handler', () => {
  beforeEach(() => {
    // select chain: select() -> from() -> where() -> limit()
    mockSelectLimit.mockResolvedValue([]);
    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelect.mockReturnValue({ from: mockSelectFrom });

    // update chain: update() -> set() -> where() -> returning()
    mockUpdateWhere.mockResolvedValue([]);
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });

    // insert chain: insert() -> values() -> returning()
    mockInsertReturning.mockResolvedValue([{ id: 'payout-1' }]);
    mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
    mockInsert.mockReturnValue({ values: mockInsertValues });
  });

  afterEach(() => {
    for (const m of [
      mockConstructEvent,
      mockSelect,
      mockSelectFrom,
      mockSelectWhere,
      mockSelectLimit,
      mockUpdate,
      mockUpdateSet,
      mockUpdateWhere,
      mockInsert,
      mockInsertValues,
      mockInsertReturning,
      mockTxSelect,
      mockTxSelectFrom,
      mockTxSelectWhere,
      mockTxSelectLimit,
      mockTxUpdate,
      mockTxUpdateSet,
      mockTxUpdateWhere,
      mockTxInsert,
      mockTxInsertValues,
      mockTransaction,
      mockPaymentIntentRetrieve,
    ]) {
      m.mockClear();
    }
  });

  it('rejects requests with invalid signatures', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const response = await POST(makeRequest('{}', 'bad_signature'));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('signature verification failed');
  });

  it('returns 400 when signature is missing', async () => {
    const request = new Request('https://app.example.com/api/webhooks/stripe', {
      method: 'POST',
      body: '{}',
      headers: {},
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Webhook signature missing');
  });

  it('returns 200 for unhandled event types', async () => {
    const event = stripeEvent('some.unknown.event', {});
    mockConstructEvent.mockReturnValue(event);

    const response = await POST(makeRequest(JSON.stringify(event)));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.received).toBe(true);
  });

  describe('checkout.session.completed', () => {
    it('calls handlePaymentSuccess via service for deposit', async () => {
      const event = stripeEvent('checkout.session.completed', {
        payment_intent: 'pi_deposit_123',
      });
      mockConstructEvent.mockReturnValue(event);

      // Stripe PaymentIntent retrieve (to get payment_method)
      mockPaymentIntentRetrieve.mockResolvedValueOnce({
        id: 'pi_deposit_123',
        payment_method: 'pm_card_123',
      });

      // findPaymentByStripeId lookup (db.select chain)
      mockSelectLimit.mockResolvedValueOnce([{ id: 'pay-1', status: 'processing' }]);

      // handlePaymentSuccess transaction:
      // 1. fetch payment
      mockTxSelectLimit
        .mockResolvedValueOnce([
          {
            id: 'pay-1',
            planId: 'plan-1',
            amountCents: 26_500,
            status: 'processing',
            type: 'deposit',
          },
        ])
        // 2. fetch plan + owner (leftJoin)
        .mockResolvedValueOnce([
          {
            id: 'plan-1',
            ownerId: 'owner-1',
            clinicId: 'clinic-1',
            status: 'pending',
            totalBillCents: 106_000,
            stripeCustomerId: 'cus_owner_123',
          },
        ])
        // 3. payout duplicate check
        .mockResolvedValueOnce([]);

      const response = await POST(makeRequest(JSON.stringify(event)));

      expect(response.status).toBe(200);
      // handlePaymentSuccess was called (via transaction)
      expect(mockTransaction).toHaveBeenCalled();
      // Payment was updated to succeeded
      expect(mockTxUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'succeeded',
          stripePaymentIntentId: 'pi_deposit_123',
        }),
      );
    });

    it('skips processing when payment is already succeeded (idempotency)', async () => {
      const event = stripeEvent('checkout.session.completed', {
        payment_intent: 'pi_deposit_dup',
      });
      mockConstructEvent.mockReturnValue(event);

      // findPaymentByStripeId: payment already succeeded
      mockSelectLimit.mockResolvedValueOnce([{ id: 'pay-1', status: 'succeeded' }]);

      const response = await POST(makeRequest(JSON.stringify(event)));

      expect(response.status).toBe(200);
      // Should NOT call handlePaymentSuccess (no transaction)
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('skips when no matching payment is found', async () => {
      const event = stripeEvent('checkout.session.completed', {
        payment_intent: 'pi_unknown',
      });
      mockConstructEvent.mockReturnValue(event);

      // findPaymentByStripeId: no payment found
      mockSelectLimit.mockResolvedValueOnce([]);

      const response = await POST(makeRequest(JSON.stringify(event)));

      expect(response.status).toBe(200);
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  describe('payment_intent.succeeded', () => {
    it('calls handlePaymentSuccess via service for installment', async () => {
      const event = stripeEvent('payment_intent.succeeded', {
        id: 'pi_installment_123',
      });
      mockConstructEvent.mockReturnValue(event);

      // findPaymentByStripeId lookup
      mockSelectLimit.mockResolvedValueOnce([{ id: 'pay-2', status: 'processing' }]);

      // handlePaymentSuccess transaction:
      mockTxSelectLimit
        .mockResolvedValueOnce([
          {
            id: 'pay-2',
            planId: 'plan-1',
            amountCents: 13_250,
            status: 'processing',
            type: 'installment',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'plan-1',
            ownerId: 'owner-1',
            clinicId: 'clinic-1',
            status: 'active',
            totalBillCents: 106_000,
            stripeCustomerId: 'cus_owner_1',
          },
        ])
        // completePlanIfAllPaid select (not all succeeded)
        .mockResolvedValueOnce([{ status: 'succeeded' }, { status: 'pending' }])
        // payout duplicate check
        .mockResolvedValueOnce([]);

      const response = await POST(makeRequest(JSON.stringify(event)));

      expect(response.status).toBe(200);
      expect(mockTransaction).toHaveBeenCalled();
      expect(mockTxUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'succeeded' }),
      );
    });

    it('skips processing when payment is already succeeded (idempotency)', async () => {
      const event = stripeEvent('payment_intent.succeeded', {
        id: 'pi_installment_dup',
      });
      mockConstructEvent.mockReturnValue(event);

      mockSelectLimit.mockResolvedValueOnce([{ id: 'pay-2', status: 'succeeded' }]);

      const response = await POST(makeRequest(JSON.stringify(event)));

      expect(response.status).toBe(200);
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  describe('payment_intent.payment_failed', () => {
    it('calls handlePaymentFailure via service', async () => {
      const event = stripeEvent('payment_intent.payment_failed', {
        id: 'pi_failed_123',
        last_payment_error: { message: 'Insufficient funds' },
      });
      mockConstructEvent.mockReturnValue(event);

      // findPaymentByStripeId lookup
      mockSelectLimit.mockResolvedValueOnce([{ id: 'pay-3', status: 'processing' }]);

      // handlePaymentFailure transaction:
      mockTxSelectLimit.mockResolvedValueOnce([
        { id: 'pay-3', status: 'processing', retryCount: 0, planId: 'plan-1' },
      ]);

      const response = await POST(makeRequest(JSON.stringify(event)));

      expect(response.status).toBe(200);
      expect(mockTransaction).toHaveBeenCalled();
      expect(mockTxUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          failureReason: 'Insufficient funds',
        }),
      );
    });

    it('skips when no matching payment is found', async () => {
      const event = stripeEvent('payment_intent.payment_failed', {
        id: 'pi_unknown',
        last_payment_error: { message: 'Error' },
      });
      mockConstructEvent.mockReturnValue(event);

      mockSelectLimit.mockResolvedValueOnce([]);

      const response = await POST(makeRequest(JSON.stringify(event)));

      expect(response.status).toBe(200);
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  describe('account.updated', () => {
    it('activates a pending clinic when fully onboarded', async () => {
      const event = stripeEvent('account.updated', {
        id: 'acct_clinic_123',
        charges_enabled: true,
        payouts_enabled: true,
      });
      mockConstructEvent.mockReturnValue(event);

      // Fetch clinic by stripeAccountId
      mockSelectLimit.mockResolvedValueOnce([{ id: 'clinic-1', status: 'pending' }]);

      const response = await POST(makeRequest(JSON.stringify(event)));

      expect(response.status).toBe(200);
      // Verify clinic status update
      expect(mockUpdateSet).toHaveBeenCalledWith({ status: 'active' });
      // Verify audit log includes both old and new values
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'clinic',
          entityId: 'clinic-1',
          action: 'status_changed',
          oldValue: { status: 'pending' },
          newValue: {
            status: 'active',
            chargesEnabled: true,
            payoutsEnabled: true,
          },
          actorType: 'system',
        }),
      );
    });

    it('skips activation when clinic is already active', async () => {
      const event = stripeEvent('account.updated', {
        id: 'acct_clinic_123',
        charges_enabled: true,
        payouts_enabled: true,
      });
      mockConstructEvent.mockReturnValue(event);

      // Clinic already active
      mockSelectLimit.mockResolvedValueOnce([{ id: 'clinic-1', status: 'active' }]);

      const response = await POST(makeRequest(JSON.stringify(event)));

      expect(response.status).toBe(200);
      // Should NOT update clinic
      expect(mockUpdateSet).not.toHaveBeenCalled();
    });

    it('skips activation when charges are not enabled', async () => {
      const event = stripeEvent('account.updated', {
        id: 'acct_clinic_123',
        charges_enabled: false,
        payouts_enabled: true,
      });
      mockConstructEvent.mockReturnValue(event);

      mockSelectLimit.mockResolvedValueOnce([{ id: 'clinic-1', status: 'pending' }]);

      const response = await POST(makeRequest(JSON.stringify(event)));

      expect(response.status).toBe(200);
      expect(mockUpdateSet).not.toHaveBeenCalled();
    });

    it('skips when no matching clinic is found', async () => {
      const event = stripeEvent('account.updated', {
        id: 'acct_unknown',
        charges_enabled: true,
        payouts_enabled: true,
      });
      mockConstructEvent.mockReturnValue(event);

      // No clinic found
      mockSelectLimit.mockResolvedValueOnce([]);

      const response = await POST(makeRequest(JSON.stringify(event)));

      expect(response.status).toBe(200);
      expect(mockUpdateSet).not.toHaveBeenCalled();
    });
  });

  // ── Error resilience ──────────────────────────────────────────────────

  describe('error resilience', () => {
    it('returns 200 when handler throws (prevents retry storms)', async () => {
      const event = stripeEvent('checkout.session.completed', {
        payment_intent: 'pi_crash_test',
      });
      mockConstructEvent.mockReturnValue(event);

      // findPaymentByStripeId succeeds
      mockSelectLimit.mockResolvedValueOnce([{ id: 'pay-crash', status: 'processing' }]);

      // PaymentIntent retrieve throws
      mockPaymentIntentRetrieve.mockRejectedValueOnce(new Error('Stripe API unreachable'));

      const response = await POST(makeRequest(JSON.stringify(event)));

      // Should return 200 with error logged, not 500
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received).toBe(true);
      expect(body.error).toBe('Handler error logged');
    });

    it('handles checkout.session.completed with null payment_intent', async () => {
      const event = stripeEvent('checkout.session.completed', {
        payment_intent: null,
      });
      mockConstructEvent.mockReturnValue(event);

      const response = await POST(makeRequest(JSON.stringify(event)));

      expect(response.status).toBe(200);
      // Should not attempt DB lookup
      expect(mockSelectLimit).not.toHaveBeenCalled();
    });

    it('handles payment_intent.payment_failed with missing last_payment_error', async () => {
      const event = stripeEvent('payment_intent.payment_failed', {
        id: 'pi_no_error_detail',
        // No last_payment_error field
      });
      mockConstructEvent.mockReturnValue(event);

      mockSelectLimit.mockResolvedValueOnce([
        { id: 'pay-no-err', status: 'processing', retryCount: 0, planId: 'plan-1' },
      ]);

      mockTxSelectLimit.mockResolvedValueOnce([
        { id: 'pay-no-err', status: 'processing', retryCount: 0, planId: 'plan-1' },
      ]);

      const response = await POST(makeRequest(JSON.stringify(event)));

      expect(response.status).toBe(200);
      // Should use 'Unknown failure' as default
      expect(mockTxUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          failureReason: 'Unknown failure',
        }),
      );
    });

    it('handles account.updated with missing charges_enabled/payouts_enabled', async () => {
      const event = stripeEvent('account.updated', {
        id: 'acct_partial',
        // No charges_enabled or payouts_enabled fields
      });
      mockConstructEvent.mockReturnValue(event);

      mockSelectLimit.mockResolvedValueOnce([{ id: 'clinic-1', status: 'pending' }]);

      const response = await POST(makeRequest(JSON.stringify(event)));

      expect(response.status).toBe(200);
      // Should NOT update because isFullyOnboarded is falsy
      expect(mockUpdateSet).not.toHaveBeenCalled();
    });

    it('handles payment_intent.succeeded for non-processing status', async () => {
      const event = stripeEvent('payment_intent.succeeded', {
        id: 'pi_already_failed',
      });
      mockConstructEvent.mockReturnValue(event);

      // Payment exists but is in 'failed' status (not 'succeeded' and not 'processing')
      mockSelectLimit.mockResolvedValueOnce([{ id: 'pay-failed', status: 'failed' }]);

      // handlePaymentSuccess transaction mock
      mockTxSelectLimit
        .mockResolvedValueOnce([
          {
            id: 'pay-failed',
            planId: 'plan-1',
            amountCents: 13_250,
            status: 'failed',
            type: 'installment',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'plan-1',
            ownerId: 'owner-1',
            clinicId: 'clinic-1',
            status: 'active',
            totalBillCents: 106_000,
          },
        ])
        .mockResolvedValueOnce([{ status: 'succeeded' }, { status: 'pending' }])
        .mockResolvedValueOnce([]);

      const response = await POST(makeRequest(JSON.stringify(event)));

      // Should process (not skip) — idempotency only skips 'succeeded' status
      expect(response.status).toBe(200);
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('handles duplicate events gracefully (same PI processed twice)', async () => {
      const event = stripeEvent('payment_intent.succeeded', {
        id: 'pi_dup_test',
      });
      mockConstructEvent.mockReturnValue(event);

      // First call: payment exists and is succeeded (already processed by first event)
      mockSelectLimit.mockResolvedValueOnce([{ id: 'pay-dup', status: 'succeeded' }]);

      const response = await POST(makeRequest(JSON.stringify(event)));

      expect(response.status).toBe(200);
      // Should NOT call handlePaymentSuccess (idempotent skip)
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });
});
