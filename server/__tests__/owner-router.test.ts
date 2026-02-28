import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { TRPCError } from '@trpc/server';
import { _resetEnvCache } from '@/lib/env';

// ── Env setup ─────────────────────────────────────────────────────────
_resetEnvCache();
for (const [key, val] of Object.entries({
  SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  DATABASE_URL: 'postgres://test:test@localhost/test',
  STRIPE_SECRET_KEY: 'sk_test_placeholder',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_placeholder',
  RESEND_API_KEY: 're_test_placeholder',
  PLAID_CLIENT_ID: 'test-plaid-client',
  PLAID_SECRET: 'test-plaid-secret',
  PLAID_ENV: 'sandbox',
  TWILIO_ACCOUNT_SID: 'ACtest_placeholder',
  TWILIO_AUTH_TOKEN: 'test-auth-token',
  TWILIO_PHONE_NUMBER: '+15551234567',
} as Record<string, string>)) {
  if (!process.env[key]) process.env[key] = val;
}
// biome-ignore lint/performance/noDelete: process.env requires delete to truly unset
delete process.env.ENABLE_MFA;

// ── Mocks ─────────────────────────────────────────────────────────────

import { createMockChain, dbMock, resetDbMocks } from './db-mock';

mock.module('@/server/db', () => ({ db: dbMock }));

// NOTE: We intentionally do NOT mock @/server/db/schema here.
// Bun's mock.module for the schema contaminates drizzle-orm internals.
mock.module('@/lib/logger', () => ({ logger: { info: mock(), warn: mock(), error: mock() } }));

mock.module('next/cache', () => ({
  unstable_cache: mock((fn: () => unknown) => fn),
  revalidateTag: mock(),
}));

// ── Stripe mocks ──────────────────────────────────────────────────────

const mockPaymentMethodsRetrieve = mock((_id: string) =>
  Promise.resolve({
    card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2027 },
  }),
);
const mockCustomersRetrieveSource = mock((_cust: string, _src: string) =>
  Promise.resolve({ bank_name: 'Chase', last4: '1234' }),
);
const mockCheckoutSessionsCreate = mock(() =>
  Promise.resolve({
    id: 'cs_setup_test_123',
    url: 'https://checkout.stripe.com/c/pay/cs_setup_test_123',
  }),
);
const mockCheckoutSessionsRetrieve = mock((_id: string) =>
  Promise.resolve({
    id: 'cs_setup_test_123',
    status: 'complete',
    setup_intent: 'seti_test_123' as string | null,
  }),
);
const mockSetupIntentsRetrieve = mock((_id: string) =>
  Promise.resolve({
    id: 'seti_test_123',
    status: 'succeeded',
    payment_method: 'pm_card_new_456' as string | null,
  }),
);

mock.module('@/lib/stripe', () => ({
  stripe: () => ({
    paymentMethods: { retrieve: mockPaymentMethodsRetrieve },
    customers: { retrieveSource: mockCustomersRetrieveSource },
    checkout: {
      sessions: { create: mockCheckoutSessionsCreate, retrieve: mockCheckoutSessionsRetrieve },
    },
    setupIntents: { retrieve: mockSetupIntentsRetrieve },
  }),
}));

// ── Router + caller setup ─────────────────────────────────────────────

const { ownerRouter } = await import('@/server/routers/owner');
const { createCallerFactory } = await import('@/server/trpc');

const createOwnerCaller = createCallerFactory(ownerRouter);

// ── Test data ─────────────────────────────────────────────────────────

const OWNER_ID = '22222222-2222-2222-2222-222222222222';
const PLAN_ID = '33333333-3333-4333-a333-333333333333';
const USER_ID = 'user-test-owner';

// biome-ignore lint/suspicious/noExplicitAny: test context
function ctx(overrides?: Record<string, unknown>): any {
  return {
    db: dbMock,
    session: { userId: USER_ID, role: 'owner' },
    supabase: {
      auth: {
        mfa: {
          listFactors: () => Promise.resolve({ data: { totp: [] } }),
          getAuthenticatorAssuranceLevel: () => Promise.resolve({ data: { currentLevel: 'aal1' } }),
        },
      },
    },
    ...overrides,
  };
}

function clearStripeMocks() {
  mockPaymentMethodsRetrieve.mockClear();
  mockCustomersRetrieveSource.mockClear();
  mockCheckoutSessionsCreate.mockClear();
  mockCheckoutSessionsRetrieve.mockClear();
  mockSetupIntentsRetrieve.mockClear();
}

// ── healthCheck ───────────────────────────────────────────────────────

describe('owner.healthCheck', () => {
  beforeEach(() => {
    resetDbMocks();
    clearStripeMocks();
  });
  afterEach(resetDbMocks);

  it('returns ok status', async () => {
    // ownerProcedure middleware: owner lookup
    createMockChain([[{ id: OWNER_ID }]]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.healthCheck();
    expect(result).toEqual({ status: 'ok', router: 'owner' });
  });
});

// ── getProfile ────────────────────────────────────────────────────────

describe('owner.getProfile', () => {
  beforeEach(() => {
    resetDbMocks();
    clearStripeMocks();
  });
  afterEach(resetDbMocks);

  it('returns owner profile when found', async () => {
    const profile = {
      id: OWNER_ID,
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '555-123-4567',
      petName: 'Whiskers',
      paymentMethod: 'debit_card',
      stripeCardPaymentMethodId: 'pm_123',
      stripeAchPaymentMethodId: null,
      addressLine1: '123 Main St',
      addressCity: 'Anytown',
      addressState: 'CA',
      addressZip: '90210',
    };
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [profile], // getProfile query
    ]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.getProfile();
    expect(result.name).toBe('Jane Doe');
    expect(result.email).toBe('jane@example.com');
  });

  it('throws NOT_FOUND when owner profile missing', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [], // empty profile result
    ]);

    const caller = createOwnerCaller(ctx());
    await expect(caller.getProfile()).rejects.toThrow(TRPCError);
  });
});

// ── updateProfile ─────────────────────────────────────────────────────

describe('owner.updateProfile', () => {
  beforeEach(() => {
    resetDbMocks();
    clearStripeMocks();
  });
  afterEach(resetDbMocks);

  it('updates name and returns updated profile', async () => {
    const updated = {
      id: OWNER_ID,
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '555-123-4567',
      petName: 'Whiskers',
      paymentMethod: 'debit_card',
    };
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [updated], // update returning
    ]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.updateProfile({ name: 'Jane Smith' });
    expect(result.name).toBe('Jane Smith');
  });

  it('throws BAD_REQUEST when no fields provided', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
    ]);

    const caller = createOwnerCaller(ctx());
    await expect(caller.updateProfile({})).rejects.toThrow(TRPCError);
  });
});

// ── updatePaymentMethod ───────────────────────────────────────────────

describe('owner.updatePaymentMethod', () => {
  beforeEach(() => {
    resetDbMocks();
    clearStripeMocks();
  });
  afterEach(resetDbMocks);

  it('switches to debit_card when card on file', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [
        {
          stripeCardPaymentMethodId: 'pm_card_saved',
          stripeAchPaymentMethodId: 'ba_ach_123',
          paymentMethod: 'bank_account',
        },
      ], // check instruments
      [{ id: OWNER_ID, paymentMethod: 'debit_card' }], // update returning
    ]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.updatePaymentMethod({ paymentMethod: 'debit_card' });
    expect(result.paymentMethod).toBe('debit_card');
  });

  it('throws BAD_REQUEST when no card on file', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [
        {
          stripeCardPaymentMethodId: null,
          stripeAchPaymentMethodId: 'ba_ach_123',
          paymentMethod: 'bank_account',
        },
      ],
    ]);

    const caller = createOwnerCaller(ctx());
    await expect(caller.updatePaymentMethod({ paymentMethod: 'debit_card' })).rejects.toThrow(
      'No debit card on file',
    );
  });

  it('throws BAD_REQUEST when no bank on file', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [
        {
          stripeCardPaymentMethodId: 'pm_card_123',
          stripeAchPaymentMethodId: null,
          paymentMethod: 'debit_card',
        },
      ],
    ]);

    const caller = createOwnerCaller(ctx());
    await expect(caller.updatePaymentMethod({ paymentMethod: 'bank_account' })).rejects.toThrow(
      'No bank account on file',
    );
  });
});

// ── setupCardPaymentMethod ────────────────────────────────────────────

describe('owner.setupCardPaymentMethod', () => {
  beforeEach(() => {
    resetDbMocks();
    clearStripeMocks();
  });
  afterEach(resetDbMocks);

  it('creates checkout session and returns session info', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [{ stripeCustomerId: 'cus_test_pm' }], // select stripeCustomerId
    ]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.setupCardPaymentMethod({
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    });
    expect(result.sessionId).toBe('cs_setup_test_123');
    expect(result.sessionUrl).toContain('checkout.stripe.com');
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledTimes(1);
  });

  it('throws BAD_REQUEST when no Stripe customer', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [{ stripeCustomerId: null }], // no customer
    ]);

    const caller = createOwnerCaller(ctx());
    await expect(
      caller.setupCardPaymentMethod({
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      }),
    ).rejects.toThrow('No Stripe customer found');
  });
});

// ── confirmCardPaymentMethod ──────────────────────────────────────────

describe('owner.confirmCardPaymentMethod', () => {
  beforeEach(() => {
    resetDbMocks();
    clearStripeMocks();
  });
  afterEach(resetDbMocks);

  it('saves card PM from completed session', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [], // update owner (no returning)
    ]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.confirmCardPaymentMethod({ sessionId: 'cs_setup_test_123' });
    expect(result.success).toBe(true);
    expect(result.paymentMethodId).toBe('pm_card_new_456');
  });

  it('rejects incomplete checkout session', async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValueOnce({
      id: 'cs_incomplete',
      status: 'open',
      setup_intent: null,
    });

    createMockChain([[{ id: OWNER_ID }]]);

    const caller = createOwnerCaller(ctx());
    await expect(caller.confirmCardPaymentMethod({ sessionId: 'cs_incomplete' })).rejects.toThrow(
      'not complete',
    );
  });

  it('rejects non-succeeded SetupIntent', async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValueOnce({
      id: 'cs_test',
      status: 'complete',
      setup_intent: 'seti_pending',
    });
    mockSetupIntentsRetrieve.mockResolvedValueOnce({
      id: 'seti_pending',
      status: 'requires_payment_method',
      payment_method: null,
    });

    createMockChain([[{ id: OWNER_ID }]]);

    const caller = createOwnerCaller(ctx());
    await expect(caller.confirmCardPaymentMethod({ sessionId: 'cs_test' })).rejects.toThrow(
      'not succeeded',
    );
  });

  it('rejects session with no SetupIntent', async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValueOnce({
      id: 'cs_no_intent',
      status: 'complete',
      setup_intent: null,
    });

    createMockChain([[{ id: OWNER_ID }]]);

    const caller = createOwnerCaller(ctx());
    await expect(caller.confirmCardPaymentMethod({ sessionId: 'cs_no_intent' })).rejects.toThrow(
      'no SetupIntent',
    );
  });
});

// ── getPaymentMethodDetails ───────────────────────────────────────────

describe('owner.getPaymentMethodDetails', () => {
  beforeEach(() => {
    resetDbMocks();
    clearStripeMocks();
  });
  afterEach(resetDbMocks);

  it('returns card details when card on file', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [
        {
          paymentMethod: 'debit_card',
          stripeCardPaymentMethodId: 'pm_card_123',
          stripeAchPaymentMethodId: null,
          stripeCustomerId: 'cus_123',
        },
      ],
    ]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.getPaymentMethodDetails();
    expect(result.currentMethod).toBe('debit_card');
    expect(result.card).toEqual({
      brand: 'visa',
      last4: '4242',
      expMonth: 12,
      expYear: 2027,
    });
    expect(result.bankAccount).toBeNull();
  });

  it('returns bank details when bank on file', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [
        {
          paymentMethod: 'bank_account',
          stripeCardPaymentMethodId: null,
          stripeAchPaymentMethodId: 'ba_ach_456',
          stripeCustomerId: 'cus_456',
        },
      ],
    ]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.getPaymentMethodDetails();
    expect(result.currentMethod).toBe('bank_account');
    expect(result.card).toBeNull();
    expect(result.bankAccount).toEqual({ bankName: 'Chase', last4: '1234' });
  });

  it('returns null for both when nothing on file', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [
        {
          paymentMethod: null,
          stripeCardPaymentMethodId: null,
          stripeAchPaymentMethodId: null,
          stripeCustomerId: 'cus_789',
        },
      ],
    ]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.getPaymentMethodDetails();
    expect(result.card).toBeNull();
    expect(result.bankAccount).toBeNull();
    expect(mockPaymentMethodsRetrieve).not.toHaveBeenCalled();
    expect(mockCustomersRetrieveSource).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND when owner missing', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [], // no owner
    ]);

    const caller = createOwnerCaller(ctx());
    await expect(caller.getPaymentMethodDetails()).rejects.toThrow('Owner not found');
  });

  it('handles Stripe card retrieval error gracefully', async () => {
    mockPaymentMethodsRetrieve.mockRejectedValueOnce(new Error('Stripe error'));

    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [
        {
          paymentMethod: 'debit_card',
          stripeCardPaymentMethodId: 'pm_invalid',
          stripeAchPaymentMethodId: null,
          stripeCustomerId: 'cus_err',
        },
      ],
    ]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.getPaymentMethodDetails();
    expect(result.card).toBeNull(); // gracefully returns null
    expect(result.currentMethod).toBe('debit_card');
  });
});

// ── getPlans ──────────────────────────────────────────────────────────

describe('owner.getPlans', () => {
  beforeEach(() => {
    resetDbMocks();
    clearStripeMocks();
  });
  afterEach(resetDbMocks);

  it('returns plans with coerced number fields', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [
        {
          id: PLAN_ID,
          clinicId: '11111111-1111-1111-1111-111111111111',
          totalBillCents: 120000,
          totalWithFeeCents: 127200,
          status: 'active',
          clinicName: 'Happy Paws Vet',
          succeededCount: '3',
          totalPaidCents: '79500',
          totalPayments: '7',
        },
      ],
    ]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.getPlans();
    expect(result).toHaveLength(1);
    expect(result[0].clinicName).toBe('Happy Paws Vet');
    // Verify Number() coercion of SQL aggregates
    expect(result[0].succeededCount).toBe(3);
    expect(result[0].totalPaidCents).toBe(79500);
    expect(result[0].totalPayments).toBe(7);
  });

  it('returns empty array when no plans', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [], // no plans
    ]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.getPlans();
    expect(result).toEqual([]);
  });
});

// ── getPlanById ───────────────────────────────────────────────────────

describe('owner.getPlanById', () => {
  beforeEach(() => {
    resetDbMocks();
    clearStripeMocks();
  });
  afterEach(resetDbMocks);

  it('returns plan with coerced numbers', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [
        {
          id: PLAN_ID,
          status: 'active',
          clinicName: 'Happy Paws',
          succeededCount: '2',
          totalPaidCents: '47700',
          totalPayments: '7',
        },
      ],
    ]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.getPlanById({ planId: PLAN_ID });
    expect(result.id).toBe(PLAN_ID);
    expect(result.succeededCount).toBe(2);
    expect(result.totalPaidCents).toBe(47700);
  });

  it('throws NOT_FOUND when plan missing', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [], // no plan
    ]);

    const caller = createOwnerCaller(ctx());
    await expect(caller.getPlanById({ planId: PLAN_ID })).rejects.toThrow('Plan not found');
  });
});

// ── getPaymentHistory ─────────────────────────────────────────────────

describe('owner.getPaymentHistory', () => {
  beforeEach(() => {
    resetDbMocks();
    clearStripeMocks();
  });
  afterEach(resetDbMocks);

  it('returns paginated payments for owned plan', async () => {
    const mockPayments = [
      { id: 'pay-1', type: 'deposit', sequenceNum: 0, amountCents: 31800, status: 'succeeded' },
      {
        id: 'pay-2',
        type: 'installment',
        sequenceNum: 1,
        amountCents: 15900,
        status: 'succeeded',
      },
    ];

    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [{ id: PLAN_ID, ownerId: OWNER_ID }], // plan lookup
      mockPayments, // payments query
      [{ count: 7 }], // count query
    ]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.getPaymentHistory({ planId: PLAN_ID });
    expect(result.payments).toHaveLength(2);
    expect(result.payments[0].type).toBe('deposit');
    expect(result.pagination.totalCount).toBe(7);
    expect(result.pagination.totalPages).toBe(1); // 7 / 10 = 1
  });

  it('throws NOT_FOUND when plan does not exist', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [], // no plan
    ]);

    const caller = createOwnerCaller(ctx());
    await expect(caller.getPaymentHistory({ planId: PLAN_ID })).rejects.toThrow('Plan not found');
  });

  it('throws FORBIDDEN when plan belongs to different owner', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [{ id: PLAN_ID, ownerId: '99999999-9999-9999-9999-999999999999' }], // different owner
    ]);

    const caller = createOwnerCaller(ctx());
    await expect(caller.getPaymentHistory({ planId: PLAN_ID })).rejects.toThrow(
      'You do not have access',
    );
  });
});

// ── getDashboardSummary ───────────────────────────────────────────────

describe('owner.getDashboardSummary', () => {
  beforeEach(() => {
    resetDbMocks();
    clearStripeMocks();
  });
  afterEach(resetDbMocks);

  it('returns summary with next payment and coerced totals', async () => {
    const nextPayment = {
      id: 'pay-3',
      planId: PLAN_ID,
      amountCents: 15900,
      scheduledAt: new Date('2026-03-20'),
      type: 'installment' as const,
      sequenceNum: 2,
    };

    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [nextPayment], // next payment
      [{ totalPaidCents: '63600', totalRemainingCents: '63600' }], // totals (string from SQL)
      [{ activePlans: '1', totalPlans: '2' }], // plan counts (string from SQL)
    ]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.getDashboardSummary();
    expect(result.nextPayment).toEqual(nextPayment);
    expect(result.totalPaidCents).toBe(63600);
    expect(result.totalRemainingCents).toBe(63600);
    expect(result.activePlans).toBe(1);
    expect(result.totalPlans).toBe(2);
  });

  it('returns null next payment when none pending', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [], // no next payment
      [{ totalPaidCents: '127200', totalRemainingCents: '0' }],
      [{ activePlans: '0', totalPlans: '1' }],
    ]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.getDashboardSummary();
    expect(result.nextPayment).toBeNull();
    expect(result.totalPaidCents).toBe(127200);
    expect(result.activePlans).toBe(0);
  });
});
