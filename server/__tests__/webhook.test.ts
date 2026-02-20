import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockConstructEvent = mock();

mock.module('@/lib/stripe', () => ({
  stripe: () => ({
    webhooks: { constructEvent: mockConstructEvent },
  }),
}));

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
  clinics: { id: 'clinics.id' },
  plans: { id: 'plans.id', status: 'plans.status' },
  payments: {
    id: 'payments.id',
    status: 'payments.status',
    planId: 'payments.plan_id',
    stripePaymentIntentId: 'payments.stripe_payment_intent_id',
    retryCount: 'payments.retry_count',
  },
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
}));

mock.module('drizzle-orm', () => ({
  eq: (col: string, val: string) => ({ col, val, type: 'eq' }),
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
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';

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

  it('returns 500 when webhook secret is missing in production', async () => {
    const env = process.env as Record<string, string | undefined>;
    const originalEnv = env.NODE_ENV;
    process.env.STRIPE_WEBHOOK_SECRET = '';
    env.NODE_ENV = 'production';

    const response = await POST(makeRequest('{}'));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain('Webhook secret not configured');

    env.NODE_ENV = originalEnv;
  });

  it('returns 400 when signature is missing but secret is configured', async () => {
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
          oldValue: JSON.stringify({ status: 'processing' }),
          newValue: JSON.stringify({ status: 'succeeded' }),
        }),
      );
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

      // Plan already completed — should skip update
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
          oldValue: JSON.stringify({ status: 'processing' }),
          newValue: JSON.stringify({ status: 'failed', failureReason: 'Insufficient funds' }),
        }),
      );
    });
  });
});
