import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
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
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_placeholder',
} as Record<string, string>)) {
  if (!process.env[key]) process.env[key] = val;
}
// biome-ignore lint/performance/noDelete: process.env requires delete to truly unset
delete process.env.ENABLE_MFA;

// ── Mocks ─────────────────────────────────────────────────────────────

import { createMockChain, dbMock, resetDbMocks } from '@/server/__tests__/db-mock';

mock.module('@/server/db', () => ({ db: dbMock }));

// NOTE: We intentionally do NOT mock @/server/db/schema here.
mock.module('@/lib/logger', () => ({ logger: { info: mock(), warn: mock(), error: mock() } }));

// Service mocks
const mockProcessDeposit = mock(() =>
  Promise.resolve({
    sessionId: 'cs_test_123',
    url: 'https://checkout.stripe.com/pay/cs_test_123',
  }),
);
const mockProcessInstallment = mock(() =>
  Promise.resolve({
    paymentIntentId: 'pi_ach_789',
    clientSecret: 'pi_ach_789_secret_abc',
  }),
);

mock.module('@/server/services/payment', () => ({
  processDeposit: mockProcessDeposit,
  processInstallment: mockProcessInstallment,
}));

const mockIdentifyDuePayments = mock(() => Promise.resolve([{ id: 'pay-1', amountCents: 15900 }]));
const mockRetryFailedPayment = mock(() => Promise.resolve(true));
const mockEscalateDefault = mock(() => Promise.resolve());
const mockIdentifyPlansForEscalation = mock(() => Promise.resolve(['plan-1', 'plan-2']));

mock.module('@/server/services/collection', () => ({
  identifyDuePayments: mockIdentifyDuePayments,
  retryFailedPayment: mockRetryFailedPayment,
  escalateDefault: mockEscalateDefault,
  identifyPlansForEscalation: mockIdentifyPlansForEscalation,
}));

// ── Router + caller setup ─────────────────────────────────────────────

const { paymentRouter } = await import('@/server/routers/payment');
const { createCallerFactory } = await import('@/server/trpc');

const createCaller = createCallerFactory(paymentRouter);

// ── Test data ─────────────────────────────────────────────────────────

const PLAN_ID = '33333333-3333-4333-a333-333333333333';
const PAYMENT_ID = '44444444-4444-4444-a444-444444444444';
const USER_ID = 'user-test-payment';
const OWNER_ID = 'owner-test-1';

// biome-ignore lint/suspicious/noExplicitAny: test context
function ownerCtx(): any {
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
  };
}

// biome-ignore lint/suspicious/noExplicitAny: test context
function adminCtx(): any {
  return {
    db: dbMock,
    session: { userId: USER_ID, role: 'admin' },
    supabase: {
      auth: {
        mfa: {
          listFactors: () => Promise.resolve({ data: { totp: [{ status: 'verified' }] } }),
          getAuthenticatorAssuranceLevel: () => Promise.resolve({ data: { currentLevel: 'aal2' } }),
        },
      },
    },
  };
}

// biome-ignore lint/suspicious/noExplicitAny: test context
function clinicCtx(): any {
  return {
    db: dbMock,
    session: { userId: USER_ID, role: 'clinic' },
    supabase: {
      auth: {
        mfa: {
          listFactors: () => Promise.resolve({ data: { totp: [{ status: 'verified' }] } }),
          getAuthenticatorAssuranceLevel: () => Promise.resolve({ data: { currentLevel: 'aal2' } }),
        },
      },
    },
  };
}

function clearServiceMocks() {
  mockProcessDeposit.mockClear();
  mockProcessInstallment.mockClear();
  mockIdentifyDuePayments.mockClear();
  mockRetryFailedPayment.mockClear();
  mockEscalateDefault.mockClear();
  mockIdentifyPlansForEscalation.mockClear();
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('payment.initiateDeposit', () => {
  beforeEach(() => {
    resetDbMocks();
    clearServiceMocks();
  });
  afterEach(resetDbMocks);

  it('owner initiates deposit successfully', async () => {
    // ownerProcedure looks up owner by authId
    createMockChain([[{ id: OWNER_ID }]]);
    const caller = createCaller(ownerCtx());

    const result = await caller.initiateDeposit({
      planId: PLAN_ID,
      successUrl: 'http://localhost:3000/owner/payments?success=true',
      cancelUrl: 'http://localhost:3000/owner/payments?cancelled=true',
    });

    expect(result.sessionId).toBe('cs_test_123');
    expect(mockProcessDeposit).toHaveBeenCalledWith({
      planId: PLAN_ID,
      ownerId: OWNER_ID,
      successUrl: 'http://localhost:3000/owner/payments?success=true',
      cancelUrl: 'http://localhost:3000/owner/payments?cancelled=true',
    });
  });

  it('rejects non-app-domain successUrl', async () => {
    createMockChain([[{ id: OWNER_ID }]]);
    const caller = createCaller(ownerCtx());

    await expect(
      caller.initiateDeposit({
        planId: PLAN_ID,
        successUrl: 'https://evil.com/steal',
        cancelUrl: 'http://localhost:3000/owner/payments',
      }),
    ).rejects.toThrow('Redirect URLs must belong to the application domain');
    expect(mockProcessDeposit).not.toHaveBeenCalled();
  });

  it('rejects non-app-domain cancelUrl', async () => {
    createMockChain([[{ id: OWNER_ID }]]);
    const caller = createCaller(ownerCtx());

    await expect(
      caller.initiateDeposit({
        planId: PLAN_ID,
        successUrl: 'http://localhost:3000/owner/payments',
        cancelUrl: 'https://evil.com/steal',
      }),
    ).rejects.toThrow('Redirect URLs must belong to the application domain');
    expect(mockProcessDeposit).not.toHaveBeenCalled();
  });

  it('rejects invalid planId format', async () => {
    createMockChain([[{ id: OWNER_ID }]]);
    const caller = createCaller(ownerCtx());

    await expect(
      caller.initiateDeposit({
        planId: 'not-a-uuid',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      }),
    ).rejects.toThrow();
    expect(mockProcessDeposit).not.toHaveBeenCalled();
  });

  it('unauthenticated user gets UNAUTHORIZED', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: test context
    const caller = createCaller({ db: dbMock, session: null, supabase: {} } as any);

    await expect(
      caller.initiateDeposit({
        planId: PLAN_ID,
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      }),
    ).rejects.toThrow('Not authenticated');
  });
});

describe('payment.processInstallment', () => {
  beforeEach(() => {
    resetDbMocks();
    clearServiceMocks();
  });
  afterEach(resetDbMocks);

  it('admin processes installment successfully', async () => {
    const caller = createCaller(adminCtx());

    const result = await caller.processInstallment({ paymentId: PAYMENT_ID });

    expect(result.paymentIntentId).toBe('pi_ach_789');
    expect(mockProcessInstallment).toHaveBeenCalledWith({
      paymentId: PAYMENT_ID,
      paymentMethodId: undefined,
    });
  });

  it('accepts optional paymentMethodId override', async () => {
    const caller = createCaller(adminCtx());

    await caller.processInstallment({
      paymentId: PAYMENT_ID,
      paymentMethodId: 'pm_override_123',
    });

    expect(mockProcessInstallment).toHaveBeenCalledWith({
      paymentId: PAYMENT_ID,
      paymentMethodId: 'pm_override_123',
    });
  });

  it('non-admin gets FORBIDDEN', async () => {
    createMockChain([[{ id: OWNER_ID }]]);
    const caller = createCaller(ownerCtx());

    await expect(caller.processInstallment({ paymentId: PAYMENT_ID })).rejects.toThrow(
      'Insufficient permissions',
    );
  });
});

describe('payment.retryPayment', () => {
  beforeEach(() => {
    resetDbMocks();
    clearServiceMocks();
  });
  afterEach(resetDbMocks);

  it('admin retries payment successfully', async () => {
    const caller = createCaller(adminCtx());
    const result = await caller.retryPayment({ paymentId: PAYMENT_ID });
    expect(result).toEqual({ success: true });
    expect(mockRetryFailedPayment).toHaveBeenCalledWith(PAYMENT_ID);
  });
});

describe('payment.getDuePayments', () => {
  beforeEach(() => {
    resetDbMocks();
    clearServiceMocks();
  });
  afterEach(resetDbMocks);

  it('returns due payments list', async () => {
    const caller = createCaller(adminCtx());
    const result = await caller.getDuePayments();
    expect(result.payments).toHaveLength(1);
    expect(result.payments[0].id).toBe('pay-1');
  });
});

describe('payment.escalateToDefault', () => {
  beforeEach(() => {
    resetDbMocks();
    clearServiceMocks();
  });
  afterEach(resetDbMocks);

  it('admin escalates plan successfully', async () => {
    const caller = createCaller(adminCtx());
    const result = await caller.escalateToDefault({ planId: PLAN_ID });
    expect(result).toEqual({ success: true });
    expect(mockEscalateDefault).toHaveBeenCalledWith(PLAN_ID);
  });
});

describe('payment.getPlansForEscalation', () => {
  beforeEach(() => {
    resetDbMocks();
    clearServiceMocks();
  });
  afterEach(resetDbMocks);

  it('returns plan IDs for escalation', async () => {
    const caller = createCaller(adminCtx());
    const result = await caller.getPlansForEscalation();
    expect(result.planIds).toEqual(['plan-1', 'plan-2']);
  });
});

describe('cross-role authorization', () => {
  beforeEach(() => {
    resetDbMocks();
    clearServiceMocks();
  });
  afterEach(resetDbMocks);

  it('clinic user cannot access admin procedures', async () => {
    // clinicProcedure requires clinic lookup
    createMockChain([[{ id: 'clinic-1' }]]);
    const caller = createCaller(clinicCtx());

    await expect(caller.processInstallment({ paymentId: PAYMENT_ID })).rejects.toThrow(
      'Insufficient permissions',
    );
  });

  it('clinic user cannot access owner procedures', async () => {
    createMockChain([[{ id: 'clinic-1' }]]);
    const caller = createCaller(clinicCtx());

    await expect(
      caller.initiateDeposit({
        planId: PLAN_ID,
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      }),
    ).rejects.toThrow('Insufficient permissions');
  });
});
