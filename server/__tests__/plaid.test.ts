import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockLinkTokenCreate = mock(() =>
  Promise.resolve({
    data: { link_token: 'link-sandbox-test-token-123' },
  }),
);

const mockItemPublicTokenExchange = mock(() =>
  Promise.resolve({
    data: {
      access_token: 'access-sandbox-test-token-456',
      item_id: 'item-sandbox-test-789',
    },
  }),
);

const mockProcessorStripeBankAccountTokenCreate = mock(() =>
  Promise.resolve({
    data: {
      stripe_bank_account_token: 'btok_test_123',
    },
  }),
);

const mockAccountsBalanceGet = mock(
  (): Promise<unknown> =>
    Promise.resolve({
      data: {
        accounts: [
          {
            account_id: 'acc-1',
            balances: {
              available: 1500.0,
              current: 1500.0,
              iso_currency_code: 'USD',
            },
          },
        ],
      },
    }),
);

mock.module('@/lib/plaid', () => ({
  plaid: () => ({
    linkTokenCreate: mockLinkTokenCreate,
    itemPublicTokenExchange: mockItemPublicTokenExchange,
    processorStripeBankAccountTokenCreate: mockProcessorStripeBankAccountTokenCreate,
    accountsBalanceGet: mockAccountsBalanceGet,
  }),
}));

const mockCustomersCreateSource = mock(() => Promise.resolve({ id: 'ba_test_456' }));

mock.module('@/lib/stripe', () => ({
  stripe: () => ({
    customers: { createSource: mockCustomersCreateSource },
  }),
}));

mock.module('@/lib/logger', () => ({
  logger: {
    info: mock(),
    warn: mock(),
    error: mock(),
  },
}));

// DB mock setup
const mockSelectLimit = mock();
const mockSelectWhere = mock();
const mockSelectFrom = mock();
const mockSelect = mock();
const mockUpdateSet = mock();
const mockUpdateWhere = mock();
const mockUpdate = mock();
const mockInsertValues = mock();
const mockInsert = mock();

mock.module('@/server/db', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
  },
}));

mock.module('@/server/db/schema', () => ({
  owners: {
    id: 'owners.id',
    plaidAccessToken: 'owners.plaid_access_token',
    plaidItemId: 'owners.plaid_item_id',
    plaidAccountId: 'owners.plaid_account_id',
    stripeCustomerId: 'owners.stripe_customer_id',
    stripeAchPaymentMethodId: 'owners.stripe_ach_payment_method_id',
  },
  clinics: { id: 'clinics.id' },
  plans: { id: 'plans.id', status: 'plans.status' },
  payments: { id: 'payments.id' },
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

mock.module('drizzle-orm', () => ({
  eq: (col: string, val: string) => ({ col, val, type: 'eq' }),
  and: (...args: unknown[]) => ({ args, type: 'and' }),
  desc: (col: string) => ({ col, type: 'desc' }),
}));

import { createAuditMock } from './audit-mock';

mock.module('@/server/services/audit', () => createAuditMock(mockInsert));

mock.module('next/cache', () => ({
  unstable_cache: mock((fn: () => unknown) => fn),
  revalidateTag: mock(),
}));

const { createLinkToken, exchangePublicToken, checkBalance } = await import(
  '@/server/services/plaid'
);

// ── Env + tRPC caller setup (for router-level tests) ────────────────
import { _resetEnvCache } from '@/lib/env';

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

const { plaidRouter } = await import('@/server/routers/plaid');
const { createCallerFactory } = await import('@/server/trpc');
const createPlaidCaller = createCallerFactory(plaidRouter);

// ── Helpers ──────────────────────────────────────────────────────────

function setupSelectChain() {
  mockSelectLimit.mockReturnValue([]);
  mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
  mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
  mockSelect.mockReturnValue({ from: mockSelectFrom });
}

function setupUpdateChain() {
  mockUpdateWhere.mockResolvedValue([]);
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdate.mockReturnValue({ set: mockUpdateSet });
}

function setupInsertChain() {
  mockInsertValues.mockResolvedValue([]);
  mockInsert.mockReturnValue({ values: mockInsertValues });
}

function clearAllMocks() {
  for (const m of [
    mockSelect,
    mockSelectFrom,
    mockSelectWhere,
    mockSelectLimit,
    mockUpdate,
    mockUpdateSet,
    mockUpdateWhere,
    mockInsert,
    mockInsertValues,
    mockLinkTokenCreate,
    mockItemPublicTokenExchange,
    mockProcessorStripeBankAccountTokenCreate,
    mockAccountsBalanceGet,
    mockCustomersCreateSource,
  ]) {
    m.mockClear();
  }
}

// ── Tests: createLinkToken ───────────────────────────────────────────

describe('createLinkToken', () => {
  afterEach(clearAllMocks);

  it('returns a link token for a valid user ID', async () => {
    const token = await createLinkToken('user-123');

    expect(token).toBe('link-sandbox-test-token-123');
    expect(mockLinkTokenCreate).toHaveBeenCalledTimes(1);
    expect(mockLinkTokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { client_user_id: 'user-123' },
        client_name: 'FuzzyCat',
        language: 'en',
      }),
    );
  });

  it('propagates errors from Plaid API', async () => {
    mockLinkTokenCreate.mockRejectedValueOnce(new Error('Plaid API error'));

    await expect(createLinkToken('user-fail')).rejects.toThrow('Plaid API error');
  });
});

// ── Tests: exchangePublicToken ───────────────────────────────────────

describe('exchangePublicToken', () => {
  beforeEach(() => {
    setupSelectChain();
    setupUpdateChain();
    setupInsertChain();
  });

  afterEach(clearAllMocks);

  it('exchanges public token, creates processor token, and stores Stripe ACH PM', async () => {
    // Owner lookup returns owner with Stripe customer ID
    mockSelectLimit.mockResolvedValueOnce([{ stripeCustomerId: 'cus_test_123' }]);

    const result = await exchangePublicToken('public-sandbox-test-token', 'owner-1', 'acc-1');

    expect(result.accessToken).toBe('access-sandbox-test-token-456');
    expect(result.itemId).toBe('item-sandbox-test-789');
    expect(result.stripeAchPaymentMethodId).toBe('ba_test_456');

    // Verify Plaid API was called
    expect(mockItemPublicTokenExchange).toHaveBeenCalledWith({
      public_token: 'public-sandbox-test-token',
    });

    // Verify processor token was created with correct access_token and account_id
    expect(mockProcessorStripeBankAccountTokenCreate).toHaveBeenCalledWith({
      access_token: 'access-sandbox-test-token-456',
      account_id: 'acc-1',
    });

    // Verify Stripe source was created
    expect(mockCustomersCreateSource).toHaveBeenCalledWith('cus_test_123', {
      source: 'btok_test_123',
    });

    // Verify DB update was called to store all fields
    expect(mockUpdateSet).toHaveBeenCalledWith({
      plaidAccessToken: 'access-sandbox-test-token-456',
      plaidItemId: 'item-sandbox-test-789',
      plaidAccountId: 'acc-1',
      stripeAchPaymentMethodId: 'ba_test_456',
    });
  });

  it('creates an audit log entry with stripeAchPaymentMethodId', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ stripeCustomerId: 'cus_test_123' }]);

    await exchangePublicToken('public-sandbox-test-token', 'owner-1', 'acc-1');

    // Audit log is written via logAuditEvent which calls db.insert
    expect(mockInsert).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'owner',
        entityId: 'owner-1',
        action: 'status_changed',
        actorType: 'owner',
        actorId: 'owner-1',
      }),
    );
  });

  it('propagates errors from Plaid API', async () => {
    mockItemPublicTokenExchange.mockRejectedValueOnce(new Error('Invalid public token'));

    await expect(exchangePublicToken('bad-token', 'owner-1', 'acc-1')).rejects.toThrow(
      'Invalid public token',
    );
  });

  it('throws when Plaid processor API fails', async () => {
    mockProcessorStripeBankAccountTokenCreate.mockRejectedValueOnce(
      new Error('Processor token creation failed'),
    );

    await expect(
      exchangePublicToken('public-sandbox-test-token', 'owner-1', 'acc-1'),
    ).rejects.toThrow('Processor token creation failed');
  });

  it('throws when Stripe createSource fails', async () => {
    // Owner lookup succeeds
    mockSelectLimit.mockResolvedValueOnce([{ stripeCustomerId: 'cus_test_123' }]);

    mockCustomersCreateSource.mockRejectedValueOnce(new Error('Invalid bank account token'));

    await expect(
      exchangePublicToken('public-sandbox-test-token', 'owner-1', 'acc-1'),
    ).rejects.toThrow('Invalid bank account token');
  });

  it('throws when owner has no Stripe customer ID', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ stripeCustomerId: null }]);

    await expect(
      exchangePublicToken('public-sandbox-test-token', 'owner-1', 'acc-1'),
    ).rejects.toThrow('does not have a Stripe customer ID');
  });
});

// ── Tests: checkBalance ──────────────────────────────────────────────

describe('checkBalance', () => {
  beforeEach(() => {
    setupSelectChain();
    setupInsertChain();
  });

  afterEach(clearAllMocks);

  it('approves when balance is sufficient', async () => {
    // Owner lookup returns owner with Plaid access token
    mockSelectLimit.mockResolvedValueOnce([{ plaidAccessToken: 'access-sandbox-test-token' }]);

    // Plaid returns $1500 available (150000 cents)
    mockAccountsBalanceGet.mockResolvedValueOnce({
      data: {
        accounts: [
          {
            account_id: 'acc-1',
            balances: { available: 1500.0, current: 1500.0 },
          },
        ],
      },
    });

    const result = await checkBalance('owner-1', 100_000); // $1000 required

    expect(result.approved).toBe(true);
    expect(result.availableBalanceCents).toBe(150_000);
    expect(result.requiredCents).toBe(100_000);
    expect(result.reason).toBe('Sufficient balance available');
  });

  it('declines when balance is insufficient', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ plaidAccessToken: 'access-sandbox-test-token' }]);

    mockAccountsBalanceGet.mockResolvedValueOnce({
      data: {
        accounts: [
          {
            account_id: 'acc-1',
            balances: { available: 50.0, current: 50.0 },
          },
        ],
      },
    });

    const result = await checkBalance('owner-1', 100_000); // $1000 required, only $50 available

    expect(result.approved).toBe(false);
    expect(result.availableBalanceCents).toBe(5_000);
    expect(result.requiredCents).toBe(100_000);
    expect(result.reason).toContain('Insufficient balance');
  });

  it('declines when no accounts are found', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ plaidAccessToken: 'access-sandbox-test-token' }]);

    mockAccountsBalanceGet.mockResolvedValueOnce({
      data: { accounts: [] },
    });

    const result = await checkBalance('owner-1', 100_000);

    expect(result.approved).toBe(false);
    expect(result.availableBalanceCents).toBe(0);
    expect(result.reason).toBe('No bank accounts found');
  });

  it('throws when owner is not found', async () => {
    mockSelectLimit.mockResolvedValueOnce([]);

    await expect(checkBalance('owner-missing', 100_000)).rejects.toThrow(
      'Owner not found: owner-missing',
    );
  });

  it('throws when owner has no Plaid access token', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ plaidAccessToken: null }]);

    await expect(checkBalance('owner-no-plaid', 100_000)).rejects.toThrow(
      'does not have a connected bank account',
    );
  });

  it('uses highest available balance across multiple accounts', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ plaidAccessToken: 'access-sandbox-test-token' }]);

    mockAccountsBalanceGet.mockResolvedValueOnce({
      data: {
        accounts: [
          {
            account_id: 'acc-1',
            balances: { available: 200.0, current: 200.0 },
          },
          {
            account_id: 'acc-2',
            balances: { available: 3000.0, current: 3000.0 },
          },
          {
            account_id: 'acc-3',
            balances: { available: 500.0, current: 500.0 },
          },
        ],
      },
    });

    const result = await checkBalance('owner-1', 250_000); // $2500 required

    expect(result.approved).toBe(true);
    expect(result.availableBalanceCents).toBe(300_000); // $3000 from acc-2
  });

  it('falls back to current balance when available is null', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ plaidAccessToken: 'access-sandbox-test-token' }]);

    mockAccountsBalanceGet.mockResolvedValueOnce({
      data: {
        accounts: [
          {
            account_id: 'acc-1',
            balances: { available: null, current: 800.0 },
          },
        ],
      },
    });

    const result = await checkBalance('owner-1', 50_000); // $500 required

    expect(result.approved).toBe(true);
    expect(result.availableBalanceCents).toBe(80_000);
  });

  it('creates an audit log entry for balance check', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ plaidAccessToken: 'access-sandbox-test-token' }]);

    mockAccountsBalanceGet.mockResolvedValueOnce({
      data: {
        accounts: [
          {
            account_id: 'acc-1',
            balances: { available: 1500.0, current: 1500.0 },
          },
        ],
      },
    });

    await checkBalance('owner-1', 100_000);

    // Audit log is written via logAuditEvent
    expect(mockInsert).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'owner',
        entityId: 'owner-1',
        action: 'status_changed',
        actorType: 'system',
      }),
    );
  });
});

// ── Router-level tests (exercises revalidateTag) ─────────────────────

describe('plaid.exchangePublicToken (router)', () => {
  beforeEach(() => {
    setupSelectChain();
    setupUpdateChain();
    setupInsertChain();
  });

  afterEach(clearAllMocks);

  it('returns success and exercises revalidateTag', async () => {
    // Global mock: service's owner lookup (stripeCustomerId)
    mockSelectLimit.mockResolvedValueOnce([{ stripeCustomerId: 'cus_test_123' }]);

    // Caller-specific thenable db for ownerProcedure middleware
    const mkChain = (res: unknown) => {
      // biome-ignore lint/suspicious/noExplicitAny: test mock
      const obj: any = {
        from: () => obj,
        where: () => obj,
        limit: () => obj,
        set: () => obj,
        // biome-ignore lint/suspicious/noThenProperty: drizzle query chain
        then: (resolve: (v: unknown) => void) => resolve(res),
      };
      return obj;
    };

    const callerDb = {
      select: mock(() => mkChain([{ id: 'owner-1' }])),
      update: mock(() => mkChain([])),
      insert: mock(() => ({ values: mock(() => Promise.resolve([])) })),
    };

    const caller = createPlaidCaller({
      db: callerDb,
      session: { userId: 'user-test-plaid', role: 'owner' },
      supabase: {
        auth: {
          mfa: {
            listFactors: () => Promise.resolve({ data: { totp: [] } }),
            getAuthenticatorAssuranceLevel: () =>
              Promise.resolve({ data: { currentLevel: 'aal1' } }),
          },
        },
      },
      // biome-ignore lint/suspicious/noExplicitAny: test context
    } as any);

    const result = await caller.exchangePublicToken({
      publicToken: 'public-sandbox-test-token',
      accountId: 'acc-1',
    });

    expect(result.success).toBe(true);
    expect(result.itemId).toBe('item-sandbox-test-789');
  });
});
