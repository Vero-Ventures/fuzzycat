import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockConstructEvent = mock();

mock.module('@/lib/stripe', () => ({
  stripe: () => ({
    webhooks: { constructEvent: mockConstructEvent },
  }),
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
const mockInsert = mock();

const mockFindMany = mock();
const mockTxSelectFrom = mock();
const mockTxSelectWhere = mock();
const mockTxUpdateSet = mock();
const mockTxUpdateWhere = mock();
const mockTxUpdate = mock();
const mockTxInsertValues = mock();
const mockTxInsert = mock();

mock.module('@/server/db', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
    query: {
      payments: { findMany: mockFindMany },
    },
    transaction: mock(async (fn: (tx: Record<string, unknown>) => Promise<void>) => {
      const tx = {
        select: mock(() => ({
          from: mockTxSelectFrom,
        })),
        update: mockTxUpdate,
        insert: mockTxInsert,
        query: {
          payments: { findMany: mockFindMany },
        },
      };
      mockTxSelectFrom.mockReturnValue({ where: mockTxSelectWhere });
      mockTxUpdateSet.mockReturnValue({ where: mockTxUpdateWhere });
      mockTxUpdate.mockReturnValue({ set: mockTxUpdateSet });
      mockTxInsertValues.mockResolvedValue([]);
      mockTxInsert.mockReturnValue({ values: mockTxInsertValues });
      await fn(tx);
    }),
  },
}));

mock.module('@/server/db/schema', () => ({
  owners: { id: 'owners.id', stripeCustomerId: 'owners.stripe_customer_id' },
  clinics: {
    id: 'clinics.id',
    stripeAccountId: 'clinics.stripe_account_id',
    status: 'clinics.status',
  },
  plans: { id: 'plans.id', status: 'plans.status' },
  payments: {
    id: 'payments.id',
    status: 'payments.status',
    planId: 'payments.plan_id',
    stripePaymentIntentId: 'payments.stripe_payment_intent_id',
    retryCount: 'payments.retry_count',
  },
  payouts: { id: 'payouts.id' },
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
  riskPoolTypeEnum: {},
  actorTypeEnum: {},
  clinicsRelations: {},
  ownersRelations: {},
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

    // insert chain: insert() -> values()
    mockInsertValues.mockResolvedValue([]);
    mockInsert.mockReturnValue({ values: mockInsertValues });

    mockFindMany.mockResolvedValue([]);
  });

  afterEach(() => {
    mockConstructEvent.mockClear();
    mockSelect.mockClear();
    mockSelectFrom.mockClear();
    mockSelectWhere.mockClear();
    mockSelectLimit.mockClear();
    mockUpdate.mockClear();
    mockUpdateSet.mockClear();
    mockUpdateWhere.mockClear();
    mockInsert.mockClear();
    mockInsertValues.mockClear();
    mockFindMany.mockClear();
    mockTxSelectFrom.mockClear();
    mockTxSelectWhere.mockClear();
    mockTxUpdate.mockClear();
    mockTxUpdateSet.mockClear();
    mockTxUpdateWhere.mockClear();
    mockTxInsert.mockClear();
    mockTxInsertValues.mockClear();
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
    it('fetches current state and updates payment and plan status', async () => {
      const event = stripeEvent('checkout.session.completed', {
        payment_intent: 'pi_deposit_123',
      });
      mockConstructEvent.mockReturnValue(event);

      // First select: fetch existing payment
      mockSelectLimit
        .mockResolvedValueOnce([{ id: 'pay-1', status: 'processing', planId: 'plan-1' }])
        // Second select: fetch existing plan
        .mockResolvedValueOnce([{ id: 'plan-1', status: 'pending' }]);

      const response = await POST(makeRequest(JSON.stringify(event)));

      expect(response.status).toBe(200);
      // Verify payment status update
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'succeeded',
          stripePaymentIntentId: 'pi_deposit_123',
        }),
      );
      // Verify audit log uses fetched oldValue
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'payment',
          oldValue: { status: 'processing' },
          newValue: { status: 'succeeded' },
        }),
      );
    });

    it('skips processing when payment is already succeeded (idempotency)', async () => {
      const event = stripeEvent('checkout.session.completed', {
        payment_intent: 'pi_deposit_dup',
      });
      mockConstructEvent.mockReturnValue(event);

      // Payment already succeeded
      mockSelectLimit.mockResolvedValueOnce([
        { id: 'pay-1', status: 'succeeded', planId: 'plan-1' },
      ]);

      const response = await POST(makeRequest(JSON.stringify(event)));

      expect(response.status).toBe(200);
      // Should NOT update payment or plan
      expect(mockUpdateSet).not.toHaveBeenCalled();
    });

    it('skips plan activation when plan is already active', async () => {
      const event = stripeEvent('checkout.session.completed', {
        payment_intent: 'pi_deposit_456',
      });
      mockConstructEvent.mockReturnValue(event);

      // Payment is processing (not yet succeeded)
      mockSelectLimit
        .mockResolvedValueOnce([{ id: 'pay-1', status: 'processing', planId: 'plan-1' }])
        // Plan is already active
        .mockResolvedValueOnce([{ id: 'plan-1', status: 'active' }]);

      const response = await POST(makeRequest(JSON.stringify(event)));

      expect(response.status).toBe(200);
      // Payment update happens (first call)
      expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'succeeded' }));
      // But plan update should NOT happen (only 1 update call total for payment)
      expect(mockUpdateSet).toHaveBeenCalledTimes(1);
    });
  });

  describe('payment_intent.succeeded', () => {
    it('fetches current state and marks payment as succeeded', async () => {
      const event = stripeEvent('payment_intent.succeeded', {
        id: 'pi_installment_123',
      });
      mockConstructEvent.mockReturnValue(event);

      // Fetch existing payment
      mockSelectLimit.mockResolvedValueOnce([
        { id: 'pay-2', status: 'processing', planId: 'plan-1' },
      ]);

      // Transaction: not all succeeded
      mockFindMany.mockResolvedValue([{ status: 'succeeded' }, { status: 'pending' }]);

      const response = await POST(makeRequest(JSON.stringify(event)));

      expect(response.status).toBe(200);
      expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'succeeded' }));
    });

    it('skips processing when payment is already succeeded (idempotency)', async () => {
      const event = stripeEvent('payment_intent.succeeded', {
        id: 'pi_installment_dup',
      });
      mockConstructEvent.mockReturnValue(event);

      // Payment already succeeded
      mockSelectLimit.mockResolvedValueOnce([
        { id: 'pay-2', status: 'succeeded', planId: 'plan-1' },
      ]);

      const response = await POST(makeRequest(JSON.stringify(event)));

      expect(response.status).toBe(200);
      // Should NOT update payment
      expect(mockUpdateSet).not.toHaveBeenCalled();
    });

    it('completes plan inside transaction when all payments succeeded', async () => {
      const event = stripeEvent('payment_intent.succeeded', {
        id: 'pi_installment_last',
      });
      mockConstructEvent.mockReturnValue(event);

      // Fetch existing payment
      mockSelectLimit.mockResolvedValueOnce([
        { id: 'pay-7', status: 'processing', planId: 'plan-1' },
      ]);

      // Transaction: all succeeded
      mockFindMany.mockResolvedValue([
        { status: 'succeeded' },
        { status: 'succeeded' },
        { status: 'succeeded' },
        { status: 'succeeded' },
        { status: 'succeeded' },
        { status: 'succeeded' },
        { status: 'succeeded' },
      ]);

      // Transaction: fetch current plan state
      mockTxSelectWhere.mockResolvedValue([{ id: 'plan-1', status: 'active' }]);
      mockTxUpdateWhere.mockResolvedValue([]);

      const response = await POST(makeRequest(JSON.stringify(event)));

      expect(response.status).toBe(200);
      // Plan update inside transaction
      expect(mockTxUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' }),
      );
    });

    it('skips plan completion if plan is already completed', async () => {
      const event = stripeEvent('payment_intent.succeeded', {
        id: 'pi_installment_dup',
      });
      mockConstructEvent.mockReturnValue(event);

      mockSelectLimit.mockResolvedValueOnce([
        { id: 'pay-7', status: 'processing', planId: 'plan-1' },
      ]);

      mockFindMany.mockResolvedValue([
        { status: 'succeeded' },
        { status: 'succeeded' },
        { status: 'succeeded' },
        { status: 'succeeded' },
        { status: 'succeeded' },
        { status: 'succeeded' },
        { status: 'succeeded' },
      ]);

      // Plan already completed -- should skip update
      mockTxSelectWhere.mockResolvedValue([{ id: 'plan-1', status: 'completed' }]);

      const response = await POST(makeRequest(JSON.stringify(event)));

      expect(response.status).toBe(200);
      // Should NOT update plan
      expect(mockTxUpdateSet).not.toHaveBeenCalled();
    });
  });

  describe('payment_intent.payment_failed', () => {
    it('fetches current state, marks payment as failed, and increments retry count', async () => {
      const event = stripeEvent('payment_intent.payment_failed', {
        id: 'pi_failed_123',
        last_payment_error: { message: 'Insufficient funds' },
      });
      mockConstructEvent.mockReturnValue(event);

      // Fetch existing payment
      mockSelectLimit.mockResolvedValueOnce([{ id: 'pay-3', status: 'processing' }]);

      const response = await POST(makeRequest(JSON.stringify(event)));

      expect(response.status).toBe(200);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          failureReason: 'Insufficient funds',
        }),
      );
      // Audit log uses fetched oldValue
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'payment',
          oldValue: { status: 'processing' },
          newValue: { status: 'failed', failureReason: 'Insufficient funds' },
        }),
      );
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
});
